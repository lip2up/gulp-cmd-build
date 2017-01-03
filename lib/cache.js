const fs = require('fs')
const path = require('path')
const md5 = require('md5')
const mkdirp = require('mkdirp')

process.umask(0)

module.exports = function(fpath, text, failGetTrans) {
    const hash = md5(text)
    const tpath = fpath.replace(/\/s\//, '/scache/')
    const { dir, name, ext } = path.parse(tpath)
    const cachedPath = path.join(dir, `${name}-${hash}${ext}`)

    const noCache = () => {
        return failGetTrans(text => {
            mkdirp.sync(dir, { mode: 0o777 })
            fs.writeFileSync(cachedPath, text, { encoding: 'utf8', mode: 0o666 })
            // console.log(`-> cached to ${cachedPath}`)
        })
    }

    return fs.existsSync(cachedPath)
        ? fs.readFileSync(cachedPath, 'utf8')
        : noCache()
}