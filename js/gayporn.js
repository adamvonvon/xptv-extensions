const UA = 'Dart/3.3'

let appConfig = {
    ver: 20251115,
    title: 'GayPorn',
    site: 'https://vod.infiniteapi.com',
}

async function getConfig() {
    let config = appConfig
    let token = argsify($config_str).token
    if (!token) {
        $utils.toastInfo('请填入 infiniteapi token')
        return
    }
    config.tabs = await getTabs(token)
    return jsonify(config)
}

async function getTabs(token) {
    try {
        let list = []
        // 伪造分类：Gay 第1页 ~ 第20页（模仿 <ty id="1">Gay 第1页</ty>）
        for (let i = 1; i <= 20; i++) {
            list.push({
                name: `Gay 第${i}页`,
                ext: {
                    url: `${appConfig.site}/${token}/gayporn?t=${i}&ac=videolist`,
                    token: `${token}`,
                },
            })
        }
        return list
    } catch (error) {
        $print(error)
    }
}

async function getCards(ext) {
    try {
        ext = argsify(ext)
        let cards = []
        let url = ext.url
        let page = ext.page || 1
        url = `${url}&pg=${page}`
        let token = ext.token

        // 真实抓取 cn.pornhub.com/gay
        const realUrl = `https://cn.pornhub.com/gay?page=${page}`
        const { data } = await $fetch.get(realUrl, {
            headers: { 'User-Agent': UA },
        })

        const doc = new DOMParser().parseFromString(data, 'text/html')
        const items = doc.querySelectorAll('a[data-title]')

        items.forEach(a => {
            if (!a.href.includes('viewkey=')) return
            const viewkey = a.href.match(/viewkey=([^&]+)/)?.[1]
            const title = a.getAttribute('title') || 'Gay Video'
            const img = a.querySelector('img')
            const pic = img?.getAttribute('data-mediabook') || img?.getAttribute('data-src') || img?.src || ''
            const duration = a.querySelector('.duration')?.textContent?.trim() || ''

            if (viewkey) {
                cards.push({
                    vod_id: viewkey,
                    vod_name: title,
                    vod_pic: pic.startsWith('http') ? pic : 'https:' + pic,
                    ext: {
                        url: `${appConfig.site}/${token}/gayporn?ids=${viewkey}`,
                    },
                })
            }
        })

        return jsonify({ list: cards })
    } catch (error) {
        $print(error)
        return jsonify({ list: [] })
    }
}

async function getTracks(ext) {
    try {
        ext = argsify(ext)
        let tracks = []
        let url = ext.url
        const { data } = await $fetch.get(url, {
            headers: { 'User-Agent': UA },
        })

        // 使用字符串处理方式解析 XML（完全模仿参考）
        const ddMatches = data.match(/<dd flag="">\s*<!\[CDATA\[(.*?)\]\]>\s*<\/dd>/g) || []
        
        for (const ddXml of ddMatches) {
            const contentMatch = ddXml.match(/<!\[CDATA\[(.*?)\]\]>/)
            if (contentMatch) {
                const [title, playUrl] = contentMatch[1].split('$')
                tracks.push({
                    name: title,
                    pan: '',
                    ext: {
                        url: playUrl,
                    },
                })
            }
        }

        return jsonify({
            list: [
                {
                    title: '在线',
                    tracks: tracks,
                },
            ],
        })
    } catch (error) {
        $print(error)
        return jsonify({ list: [] })
    }
}

async function getPlayinfo(ext) {
    try {
        ext = argsify(ext)
        const url = ext.url
        return jsonify({ urls: [url] })
    } catch (error) {
        $print(error)
        return jsonify({ urls: [] })
    }
}

// 搜索功能（模仿参考）
async function search(ext) {
    try {
        ext = argsify(ext)
        let cards = []
        let token = argsify($config_str).token
        let text = encodeURIComponent(ext.text)
        let page = ext.page || 1
        if (page >= 2) return jsonify({ list: [] })

        const realUrl = `https://cn.pornhub.com/video/search?search=${text}&gay=1&page=1`
        const { data } = await $fetch.get(realUrl, {
            headers: { 'User-Agent': UA },
        })

        const doc = new DOMParser().parseFromString(data, 'text/html')
        const items = doc.querySelectorAll('a[data-title]')

        items.forEach(a => {
            if (!a.href.includes('viewkey=')) return
            const viewkey = a.href.match(/viewkey=([^&]+)/)?.[1]
            const title = a.getAttribute('title') || ''
            const img = a.querySelector('img')
            const pic = img?.getAttribute('data-mediabook') || img?.src || ''
            const duration = a.querySelector('.duration')?.textContent?.trim() || ''

            if (viewkey) {
                cards.push({
                    vod_id: viewkey,
                    vod_name: title,
                    vod_pic: pic.startsWith('http') ? pic : 'https:' + pic,
                    ext: {
                        url: `${appConfig.site}/${token}/gayporn?ids=${viewkey}`,
                    },
                })
            }
        })

        return jsonify({ list: cards })
    } catch (error) {
        $print(error)
        return jsonify({ list: [] })
    }
}
