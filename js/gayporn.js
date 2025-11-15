const UA = 'Dart/3.3 (dart:io)';

let appConfig = {
    ver: 20251115,
    title: 'GayPorn',
    site: 'https://vod.infiniteapi.com',
};

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
        let list = [];
        // 伪造分类（Gay 1~30页），模拟 infiniteapi 的 <ty id="x">名称</ty>
        for (let i = 1; i <= 30; i++) {
            list.push({
                name: `Gay 第${i}页`,
                ext: {
                    url: `https://cn.pornhub.com/gay?page=${i}`,
                    token: token,
                    page: i
                },
            });
        }
        return list;
    } catch (error) {
        $print('getTabs error: ' + error);
        return [];
    }
}

async function getCards(ext) {
    try {
        ext = argsify(ext);
        let cards = [];
        let url = ext.url;
        let token = ext.token;

        const { data } = await $fetch.get(url, {
            headers: { 'User-Agent': UA }
        });

        const doc = new DOMParser().parseFromString(data, 'text/html');
        const items = doc.querySelectorAll('a[data-title]');
        let count = 0;

        items.forEach(a => {
            if (count >= 24) return; // 每页最多24条
            if (!a.href.includes('viewkey=')) return;

            const viewkey = a.href.match(/viewkey=([^&]+)/)?.[1];
            const title = a.getAttribute('title') || 'Gay Video';
            const img = a.querySelector('img');
            const pic = img?.getAttribute('data-mediabook') || img?.getAttribute('data-src') || img?.src || '';
            const duration = a.querySelector('.duration')?.textContent?.trim() || '';

            if (viewkey) {
                cards.push({
                    vod_id: viewkey,
                    vod_name: title,
                    vod_pic: pic.startsWith('http') ? pic : 'https:' + pic,
                    vod_remarks: duration,
                    ext: {
                        url: a.href,
                        token: token
                    },
                });
                count++;
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
        let token = ext.token;

        const { data } = await $fetch.get(url, {
            headers: { 'User-Agent': UA }
        });

        const doc = new DOMParser().parseFromString(data, 'text/html');
        const script = Array.from(doc.scripts).find(s => s.textContent.includes('mediaDefinitions'));

        if (script) {
            const match = script.textContent.match(/mediaDefinitions\s*=\s*(\[[\s\S]*?\]);/);
            if (match) {
                try {
                    const media = JSON.parse(match[1]);
                    const sorted = media
                        .filter(m => m.videoUrl)
                        .sort((a, b) => (b.quality || 0) - (a.quality || 0))
                        .slice(0, 3); // 取前3个清晰度

                    sorted.forEach(m => {
                        tracks.push({
                            name: `${m.quality}p`,
                            pan: '',
                            ext: { url: m.videoUrl },
                        });
                    });
                } catch (e) {
                    $print('mediaDefinitions parse error: ' + e);
                }
            }
        }

        // 兜底 m3u8
        if (tracks.length === 0) {
            const m3u8 = data.match(/"defaultVideoUrl":"([^"]+\.m3u8[^"]*)"/);
            if (m3u8) {
                tracks.push({
                    name: 'HLS 720p',
                    pan: '',
                    ext: { url: m3u8[1].replace(/\\/g, '') },
                });
            }
        }

        return jsonify({
            list: [{
                title: '在线',
                tracks: tracks.length > 0 ? tracks : [{ name: '解析失败', pan: '', ext: { url: '' } }]
            }]
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
        let token = argsify($config_str).token;
        let text = encodeURIComponent(ext.text);
        let page = ext.page || 1;
        if (page >= 2) return jsonify({ list: [] });

        const url = `https://cn.pornhub.com/video/search?search=${text}&gay=1&page=1`;
        const { data } = await $fetch.get(url, {
            headers: { 'User-Agent': UA }
        });

        const doc = new DOMParser().parseFromString(data, 'text/html');
        const items = doc.querySelectorAll('a[data-title]');

        items.forEach(a => {
            if (!a.href.includes('viewkey=')) return;
            const viewkey = a.href.match(/viewkey=([^&]+)/)?.[1];
            const title = a.getAttribute('title') || '';
            const img = a.querySelector('img');
            const pic = img?.getAttribute('data-mediabook') || img?.src || '';
            const duration = a.querySelector('.duration')?.textContent?.trim() || '';

            if (viewkey) {
                cards.push({
                    vod_id: viewkey,
                    vod_name: title,
                    vod_pic: pic.startsWith('http') ? pic : 'https:' + pic,
                    vod_remarks: duration,
                    ext: { url: a.href, token: token },
                });
            }
        });

        return jsonify({ list: cards });
    } catch (error) {
        $print('search error: ' + error);
        return jsonify({ list: [] });
    }
}
