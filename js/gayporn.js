const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36';

// 切换到全球稳定源
let appConfig = {
    ver: 20251115,
    title: 'gayporn',
    site: 'https://vod.infiniteapi.com',
};

function buildXML(tyList = [], videoList = []) {
    let xml = '<?xml version="1.0" encoding="utf-8"?><rss version="5.0">';
    
    if (tyList.length > 0) {
        xml += '<list page="1" pagecount="1" pagesize="' + tyList.length + '" total="' + tyList.length + '">';
        tyList.forEach(ty => {
            xml += `<ty id="${ty.id}">${escapeXml(ty.name)}</ty>`;
        });
        xml += '</list>';
    }
    
    if (videoList.length > 0) {
        xml += '<list page="' + (videoList[0].page || 1) + '" pagecount="999" pagesize="' + videoList.length + '" total="9999">';
        videoList.forEach(v => {
            xml += `<video>
                <id>${escapeXml(v.id)}</id>
                <name><![CDATA[${escapeXml(v.name)}]]></name>
                <pic>${escapeXml(v.pic)}</pic>
                <last>${escapeXml(v.last || '')}</last>
                <note>${escapeXml(v.note || '')}</note>
                <dt>${escapeXml(v.dt || 'MP4')}</dt>
            </video>`;
        });
        xml += '</list>';
    } else {
        // 兜底：空列表时显示提示
        xml += '<list page="1" pagecount="1" pagesize="0" total="0"><video><name>加载中... 请稍后</name></video></list>';
    }
    
    xml += '</rss>';
    return xml;
}

function escapeXml(str) {
    return (str || '').toString().replace(/[<>&'"]/g, c => ({
        '<': '&lt;', '>': '&gt;', '&': '&amp;', "'": '&apos;', '"': '&quot;'
    })[c]);
}

// 延迟函数（防反爬）
function delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

async function getConfig() {
    let config = appConfig;
    let token = argsify($config_str).token;
    if (!token) {
        $utils.toastInfo('请填入 infiniteapi token');
        return;
    }
    config.tabs = await getTabs(token);
    return jsonify(config);
}

async function getTabs(token) {
    try {
        await delay(500); // 随机延迟
        let list = [];
        // 伪造 Gay 分类（1~20页，减少加载压力）
        for (let i = 1; i <= 20; i++) {
            list.push({
                name: `Gay 同志 第${i}页`,
                ext: {
                    url: `https://www.pornhub.com/gay?page=${i}`,
                    token: token,
                    page: i
                },
            });
        }
        return list;
    } catch (e) {
        $print(e);
        return [{ name: '默认 Gay', ext: { url: 'https://www.pornhub.com/gay?page=1', token: token } }];
    }
}

async function getCards(ext) {
    try {
        ext = argsify(ext);
        let url = ext.url;
        let token = ext.token;
        await delay(Math.random() * 1000 + 500); // 0.5~1.5s 延迟

        const { data } = await $fetch.get(url, {
            headers: { 
                'User-Agent': UA,
                'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
                'Accept-Language': 'zh-CN,zh;q=0.9,en;q=0.8'
            },
        });

        const doc = new DOMParser().parseFromString(data, 'text/html');
        const items = doc.querySelectorAll('.pcVideoListItem a, .videoBoxThumb a, a[data-mediabook]');
        let videos = [];

        items.forEach((a, index) => {
            if (index > 23) return; // 限制24条
            if (!a.href || !a.href.includes('viewkey=')) return;

            const viewkey = a.href.match(/viewkey=([^&]+)/)?.[1];
            const title = a.getAttribute('title') || a.querySelector('img')?.alt || `Gay 视频 ${index + 1}`;
            const img = a.querySelector('img');
            const pic = img?.getAttribute('data-mediabook') || img?.getAttribute('data-src') || img?.src || '';
            const duration = a.querySelector('.duration, .video-duration')?.textContent?.trim() || '';

            if (viewkey) {
                videos.push({
                    id: viewkey,
                    name: title,
                    pic: pic.startsWith('http') ? pic : 'https:' + pic,
                    last: duration,
                    note: 'HD Gay',
                    dt: 'Pornhub',
                    page: ext.page || 1
                });
            }
        });

        // 重试机制：如果少于5条，尝试重抓
        if (videos.length < 5) {
            $print('视频少，重试...');
            await delay(1000);
            return getCards(ext); // 递归重试（最多3次，XPTV 防循环）
        }

        return buildXML([], videos);
    } catch (e) {
        $print('getCards error: ' + e);
        return buildXML([], []);
    }
}

async function getTracks(ext) {
    try {
        ext = argsify(ext);
        let url = `https://www.pornhub.com/view_video.php?viewkey=${ext.vod_id || ext.url.split('viewkey=')[1]}`;
        await delay(800);

        const { data } = await $fetch.get(url, {
            headers: { 'User-Agent': UA }
        });

        const doc = new DOMParser().parseFromString(data, 'text/html');
        const script = Array.from(doc.scripts).find(s => s.textContent && s.textContent.includes('mediaDefinitions'));
        let playUrls = [];

        if (script) {
            const match = script.textContent.match(/mediaDefinitions\s*=\s*(\[[\s\S]*?\]);/);
            if (match) {
                try {
                    const media = JSON.parse(match[1]);
                    const sorted = media
                        .filter(m => m.videoUrl && m.quality)
                        .sort((a, b) => (b.quality - a.quality));

                    sorted.slice(0, 3).forEach(m => { // 只取前3个清晰度
                        playUrls.push(`${m.quality}p$$${m.videoUrl}`);
                    });
                } catch (e) {
                    $print('JSON 解析失败: ' + e);
                }
            }
        }

        // m3u8 兜底
        if (playUrls.length === 0) {
            const m3u8Match = data.match(/"defaultVideoUrl":"([^"]+\.m3u8[^"]*)"/);
            if (m3u8Match) {
                playUrls.push(`HLS 720p$$${m3u8Match[1].replace(/\\/g, '')}`);
            }
        }

        // 构造 XML
        let xml = '<?xml version="1.0" encoding="utf-8"?><rss version="5.0"><list>';
        playUrls.forEach(urlStr => {
            const [title, playUrl] = urlStr.split('$$');
            xml += `<dd flag=""><![CDATA[${escapeXml(title)}$$${escapeXml(playUrl)}]]></dd>`;
        });
        if (playUrls.length === 0) {
            xml += '<dd flag=""><![CDATA[加载失败，请重试]]></dd>';
        }
        xml += '</list></rss>';

        return xml;
    } catch (e) {
        $print('getTracks error: ' + e);
        return '<?xml version="1.0" encoding="utf-8"?><rss version="5.0"><list><dd flag=""><![CDATA[解析失败]]></dd></list></rss>';
    }
}

async function getPlayinfo(ext) {
    try {
        ext = argsify(ext);
        return jsonify({ urls: [ext.url] });
    } catch (e) {
        return jsonify({ urls: [] });
    }
}

async function search(ext) {
    try {
        ext = argsify(ext);
        let text = encodeURIComponent(ext.text);
        let page = ext.page || 1;
        if (page >= 2) return buildXML();

        const url = `https://www.pornhub.com/video/search?search=${text}&gay=1&page=1`;
        await delay(600);

        const { data } = await $fetch.get(url, { headers: { 'User-Agent': UA } });

        const doc = new DOMParser().parseFromString(data, 'text/html');
        const items = doc.querySelectorAll('a[data-mediabook]');
        let videos = [];

        items.slice(0, 20).forEach((a, index) => {
            if (!a.href.includes('viewkey=')) return;
            const viewkey = a.href.match(/viewkey=([^&]+)/)?.[1];
            const title = a.getAttribute('title') || `搜索结果 ${index + 1}`;
            const img = a.querySelector('img');
            const pic = img?.getAttribute('data-mediabook') || img?.src || '';
            const duration = a.querySelector('.duration')?.textContent?.trim() || '';

            if (viewkey) {
                videos.push({
                    id: viewkey,
                    name: title,
                    pic: pic.startsWith('http') ? pic : 'https:' + pic,
                    last: duration,
                    note: 'Gay 搜索',
                    dt: 'Pornhub'
                });
            }
        });

        return buildXML([], videos);
    } catch (e) {
        $print('search error: ' + e);
        return buildXML([], []);
    }
}
