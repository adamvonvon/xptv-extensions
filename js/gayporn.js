const UA = 'Dart/3.3 (dart:io)';

let appConfig = {
    ver: 20250507,
    title: 'Pornhub CN Gay',
    site: 'https://vod.infiniteapi.com',
};

async function getConfig() {
    let config = appConfig;
    let token = argsify($config_str).token;
    if (!token) {
        $utils.toastInfo('one為biu提供的付費源，請填入token再使用');
        return;
    }
    config.tabs = await getTabs(token);
    return jsonify(config);
}

async function getTabs(token) {
    try {
        let list = [];
        // 直接构造 cn.pornhub.com/gay 的分页 URL 列表（模拟 tagList）
        const base = "https://cn.pornhub.com/gay?page=${pageNumber}";
        for (let i = 1; i <= 50; i++) {  // 最多50页，可自行调
            list.push({
                name: `Gay 第${i}页`,
                ext: {
                    url: base.replace("${pageNumber}", i),
                },
            });
        }
        return list;
    } catch (error) {
        $print(error);
        return [];
    }
}

async function getCards(ext) {
    try {
        ext = argsify(ext);
        let cards = [];
        let url = ext.url;
        let page = ext.page || 1;

        if (page >= 2 && url.includes('t=2')) {
            $utils.toastInfo('本分类为每日更新推荐，查看更多请切换其他频道分类');
            return;
        }

        const { data } = await $fetch.get(url, {
            headers: { 'User-Agent': UA },
        });

        const doc = new DOMParser().parseFromString(data, 'text/html');
        const items = doc.querySelectorAll('.pcVideoListItem, .videoPreviewBg a[data-title]');

        items.forEach(item => {
            const a = item.tagName === 'A' ? item : item.querySelector('a');
            if (!a || !a.href.includes('viewkey=')) return;

            const title = a.getAttribute('title') || a.querySelector('.title')?.textContent?.trim() || '未知';
            const img = a.querySelector('img');
            const thumb = img?.getAttribute('data-mediabook') || img?.getAttribute('data-src') || img?.src || '';
            const duration = a.querySelector('.duration')?.textContent?.trim() || '';
            const viewkey = a.href.match(/viewkey=([^&]+)/)?.[1];

            if (viewkey) {
                cards.push({
                    vod_id: viewkey,
                    vod_name: title,
                    vod_pic: thumb.startsWith('http') ? thumb : 'https:' + thumb,
                    vod_remarks: duration,
                    ext: {
                        url: a.href,
                    },
                });
            }
        });

        return jsonify({ list: cards });
    } catch (error) {
        $print('getCards error: ' + error);
        return jsonify({ list: [] });
    }
}

async function getTracks(ext) {
    try {
        ext = argsify(ext);
        let tracks = [];
        let url = ext.url;

        const { data } = await $fetch.get(url, {
            headers: { 'User-Agent': UA },
        });

        const doc = new DOMParser().parseFromString(data, 'text/html');
        const script = Array.from(doc.scripts).find(s => s.textContent.includes('mediaDefinitions'));

        if (script) {
            const match = script.textContent.match(/mediaDefinitions\s*=\s*(\[[\s\S]*?\]);/);
            if (match) {
                try {
                    const media = JSON.parse(match[1]);
                    const best = media
                        .filter(m => m.videoUrl)
                        .sort((a, b) => (b.quality || 0) - (a.quality || 0))[0];

                    if (best?.videoUrl) {
                        tracks.push({
                            name: `Pornhub ${best.quality}p`,
                            pan: '',
                            ext: { url: best.videoUrl },
                        });
                    }
                } catch (e) {
                    $print('解析 mediaDefinitions 失败: ' + e);
                }
            }
        }

        // 兜底：如果没解析到，用 m3u8 fallback（部分视频有）
        if (tracks.length === 0) {
            const m3u8Match = data.match(/"defaultVideoUrl":"([^"]+\.m3u8[^"]*)"/);
            if (m3u8Match) {
                tracks.push({
                    name: 'Pornhub HLS',
                    pan: '',
                    ext: { url: m3u8Match[1].replace(/\\/g, '') },
                });
            }
        }

        return jsonify({
            list: [{
                title: '在线',
                tracks: tracks,
            }],
        });
    } catch (error) {
        $print('getTracks error: ' + error);
        return jsonify({ list: [] });
    }
}

async function getPlayinfo(ext) {
    try {
        ext = argsify(ext);
        const url = ext.url;
        return jsonify({ urls: [url] });
    } catch (error) {
        $print('getPlayinfo error: ' + error);
        return jsonify({ urls: [] });
    }
}

async function search(ext) {
    try {
        ext = argsify(ext);
        let cards = [];
        let text = encodeURIComponent(ext.text);
        let page = ext.page || 1;
        if (page >= 2) return jsonify({ list: [] });

        const url = `https://cn.pornhub.com/video/search?search=${text}&gay=1&page=1`;
        const { data } = await $fetch.get(url, {
            headers: { 'User-Agent': UA },
        });

        const doc = new DOMParser().parseFromString(data, 'text/html');
        doc.querySelectorAll('a[data-title]').forEach(a => {
            if (!a.href.includes('viewkey=')) return;
            const title = a.getAttribute('title') || '';
            const img = a.querySelector('img');
            const thumb = img?.getAttribute('data-mediabook') || img?.src || '';
            const viewkey = a.href.match(/viewkey=([^&]+)/)?.[1];
            const duration = a.querySelector('.duration')?.textContent?.trim() || '';

            if (viewkey) {
                cards.push({
                    vod_id: viewkey,
                    vod_name: title,
                    vod_pic: thumb.startsWith('http') ? thumb : 'https:' + thumb,
                    vod_remarks: duration,
                    ext: { url: a.href },
                });
            }
        });

        return jsonify({ list: cards });
    } catch (error) {
        $print('search error: ' + error);
        return jsonify({ list: [] });
    }
}
