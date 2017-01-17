const ast = require('cmd-util').ast
const path = require('path')
const removeJs = require('./util').removeJs

module.exports = function(file, opts) {
    const data = file.contents.toString('utf8')
    const html = '"' + data.replace(/\n|\r\n/g, '\\n').replace(/\"/g, '\\\"') + '"'

    const filename = path.relative(file.cwd, file.path)
    const id = opts.idleading + removeJs(filename)
    const text = `define("${id}", [], function() {
    return ${html};
})`
    console.log(text)
    const astCache = ast.getAst(text)

    file.path += '.js'

    return {
        id: id
        , deps: []
        , file: file
        , astCache: astCache
    }
}
