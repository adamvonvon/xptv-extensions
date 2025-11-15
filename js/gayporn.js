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
        for (let i = 1; i <= 20; i++) {
            list.push({
                name: `Gay 第${i}页`,
                ext: {
                    url: `${appConfig.site}/${token}/gayporn?t=${i}&ac=videolist&pg=1`,
                    token: token
                },
            });
        }
        return list;
    } catch (e) {
        $print('getTabs error: ' + e);
        return [];
    }
}

async function getCards(ext) {
    try {
        ext = argsify(ext);
        let cards = [];
        let page = ext.page || 1;
        let url = `https://cn.pornhub.com/gay?page=${page}`;

        const { data } = await $fetch.get(url, { headers: { 'User-Agent': UA } });
        const doc = new DOMParser().parseFromString(data, 'text/html');
        const items = doc.querySelectorAll('a[data-title]');

        items.forEach(a => {
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
                        url: `${appConfig.site}/${ext.token}/gayporn?ids=${viewkey}`,
                        token: ext.token
                    },
                });
            }
        });

        return jsonify({ list: cards });
    } catch (e) {
        $print('getCards error: ' + e);
        return jsonify({ list: [] });
    }
}

async function getTracks(ext) {
    try {
        ext = argsify(ext);
        let tracks = [];
        let viewkey = ext.url.match(/ids=([^&]+)/)?.[1];
        if (!viewkey) return jsonify({ list: [] });

        let url = `https://cn.pornhub.com/view_video.php?viewkey=${viewkey}`;
        const { data } = await $fetch.get(url, { headers: { 'User-Agent': UA } });

        const script = Array.from(new DOMParser().parseFromString(data, 'text/html').scripts)
            .find(s => s.textContent.includes('mediaDefinitions'));

        if (script) {
            const match = script.textContent.match(/mediaDefinitions\s*=\s*(\[[\s\S]*?\]);/);
            if (match) {
                try {
                    const media = JSON.parse(match[1]);
                    media
                        .filter(m => m.videoUrl)
                        .sort((a, b) => (b.quality || 0) - (a.quality || 0))
                        .slice(0, 3)
                        .forEach(m => {
                            tracks.push({
                                name: `${m.quality}p`,
                                pan: '',
                                ext: { url: m.videoUrl },
                            });
                        });
                } catch (e) {}
            }
        }

        if (tracks.length === 0) {
            tracks.push({ name: '无源', pan: '', ext: { url: '' } });
        }

        return jsonify({
            list: [{ title: '在线', tracks }]
        });
    } catch (e) {
        $print('getTracks error: ' + e);
        return jsonify({ list: [] });
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
        let cards = [];
        let token = argsify($config_str).token;
        let text = encodeURIComponent(ext.text);
        let page = ext.page || 1;
        if (page >= 2) return jsonify({ list: [] });

        let url = `https://cn.pornhub.com/video/search?search=${text}&gay=1&page=1`;
        const { data } = await $fetch.get(url, { headers: { 'User-Agent': UA } });

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
                    ext: {
                        url: `${appConfig.site}/${token}/gayporn?ids=${viewkey}`,
                        token: token
                    },
                });
            }
        });

        return jsonify({ list: cards });
    } catch (e) {
        $print('search error: ' + e);
        return jsonify({ list: [] });
    }
}
