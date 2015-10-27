var handlebars = require('handlebars')
var path = require('path')
var parseError = require('./util').parseError
var removeJs = require('./util').removeJs

module.exports = function(file, opts) {
    var text = file.contents.toString('utf8')

    try {
        var code = handlebars.precompile(text, opts.handlebars)
    } catch (ex) {
        console.log(ex)
        throw parseError(file.path, ex.message)
    }

    var filename = path.relative(file.cwd, file.path)
    var id = opts.idleading + removeJs(filename)
    var cont = `define("${id}", ["${opts.handlebars.id}"], function(require) {
    var Handlebars = require("${opts.handlebars.id}")
    var template = Handlebars.template
    return template(${code})
})`

    file.path += '.js'

    return {
        id: id
        , deps: [ opts.handlebars.id ]
        , file: file
        , text: cont
    }
}