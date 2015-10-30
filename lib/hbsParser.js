var ast = require('cmd-util').ast
var handlebars = require('handlebars')
var path = require('path')
var parseError = require('./util').parseError
var removeJs = require('./util').removeJs

module.exports = function(file, opts) {
    var data = file.contents.toString('utf8')

    try {
        var code = handlebars.precompile(data, opts.handlebars)
    } catch (ex) {
        throw parseError(ex.message, file.path)
    }

    var filename = path.relative(file.cwd, file.path)
    var id = opts.idleading + removeJs(filename)
    var alias = opts.handlebars.id
    var text = `define("${id}", ["${alias}"], function(require) {
    var Handlebars = require("${alias}")
    var template = Handlebars.template
    return template(${code})
})`
    var astCache = ast.getAst(text)

    file.path += '.js'

    return {
        id: id
        , deps: [ opts.handlebars.id ]
        , file: file
        , astCache: astCache
    }
}