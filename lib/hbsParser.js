var ast = require('cmd-util').ast
var handlebars = require('handlebars')
var path = require('path')
var parseError = require('./util').parseError
var removeJs = require('./util').removeJs

patchHandlebars(handlebars)

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

// patch for handlebars
function patchHandlebars(Handlebars) {
    Handlebars.JavaScriptCompiler.prototype.preamble = function() {
        var out = []

        if (!this.isChild) {
            var namespace = this.namespace
            var lines = []
            lines.push(`  helpers = helpers || {}
  for (var key in ${namespace}.helpers) {
    helpers[key] = helpers[key] || ${namespace}.helpers[key]
  }`)
            if (this.environment.usePartial) {
                lines.push(`  partials = partials || ${namespace}.partials`)
            }
            if (this.options.data) {
                lines.push(`  data = data || {}`)
            }
            out.push(lines.join('\n'))
        } else {
            out.push('')
        }

        if (!this.environment.isSimple) {
            out.push(', buffer = ' + this.initializeBuffer())
        } else {
            out.push('')
        }

        // track the last context pushed into place to allow skipping the
        // getContext opcode when it would be a noop
        this.lastContext = 0
        this.source = out
    }
}
