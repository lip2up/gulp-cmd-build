var ast = require('cmd-util').ast
var path = require('path')
var parseError = require('./util').parseError
var removeJs = require('./util').removeJs

module.exports = function(file, opts) {
    var text = file.contents.toString('utf8')

    try {
        var astCache = ast.getAst(text)
    } catch (ex) {
        throw parseError(file.path, ex.message, ex.line)
    }

    var meta = ast.parseFirst(astCache)
    if (!meta) {
        throw parseError(file.path, 'not cmd module')
    }

    var filename = path.relative(file.cwd, file.path)
    var id = meta.id ? meta.id : opts.idleading + removeJs(filename)
    var deps = meta.dependencies.map(removeJs)
    ast.modify(astCache, { id: id, dependencies: deps })

    return {
        id: id
        , deps: deps
        , file: file
        , astCache: astCache
    }
}