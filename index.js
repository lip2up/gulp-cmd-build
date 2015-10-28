var gulp = require('gulp')
var gutil = require('gulp-util')
var extend = require('node.extend')
var es = require('event-stream')
var path = require('path')
var ast = require('cmd-util').ast
var iduri = require('cmd-util').iduri
var unique = require('./lib/util').unique
var pushList = require('./lib/util').pushList
var parseError = require('./lib/util').parseError
var uglify = require('uglify-js')
require('colors')
var pad = require('pad')

var defOpts = {
    idleading: ''
    , parsers: {
        '.js': require('./lib/jsParser')
        , '.hbs': require('./lib/hbsParser')
        , '.handlebars': require('./lib/hbsParser')
    }
    , handlebars: {
        id: 'gallery/handlebars/1.0.2/runtime'
    }
    , minify: true
}

var codeOpts = {
    beautify: true
    , comments: true
}
var minifyOpts = {
    fromString: true
    , output: {}
}

module.exports = function(_opts) {
    var opts = extend(true, {}, defOpts, _opts)
    var fileList = []
    var itemList = []
    var itemMap = {}

    function getDeps(item) {
        return item.deps.reduce(function(result, dep) {
            var reqList = result.reqList
            var conList = result.conList

            var id = iduri.absolute(item.id, dep)

            if (id != opts.handlebars.id) {
                var t = itemMap[id]
                if (t != null) {
                    var r = getDeps(t)
                    pushList(reqList, dep, r.reqList)
                    dep[0] == '.' && pushList(conList, id, r.conList)
                } else {
                    throw parseError(item.file.path, `"${id}" not found`)
                }
            }

            return result
        }, { reqList: [], conList: [] })
    }

    function filterDeps(deps) {
        return unique(deps).filter(function(dep) {
            return dep != opts.handlebars.id
        })
    }

    function getText(item) {
        var astCache = item.astCache
        if (astCache != null) {
            var result = getDeps(item)
            var reqList = filterDeps(result.reqList)
            var code = ast.modify(astCache, { dependencies: reqList })
            var text = code.print_to_string(codeOpts)
        } else {
            var text = item.text
        }
        return text
    }

    function doTrans(file) {
        var extname = path.extname(file.path)
        var parser = opts.parsers[extname]
        if (parser) {
            var item = parser(file, opts)
            itemList.push(item)
            itemMap[item.id] = item
        }
    }

    function doConcat(item) {
        var result = getDeps(item)
        var deps = filterDeps([ item.id ].concat(result.conList))

        var _cont = deps.map(function(dep) {
            var t = itemMap[dep]
            if (t == null) {
                throw parseError(item.file.path, `"${dep}" not found`)
            }
            return getText(t)
        })
        .join('\n\n')

        var cont = opts.minify ? uglify.minify(_cont, minifyOpts).code : _cont
        item.file.contents = new Buffer(cont)
    }

    function progress(total, type, index) {
        var prog = Math.floor((index + 1) * 100 / total)
        var msg = `\t${'-> [js]'.green} ${type} ... ${prog}${prog == 100 ? '\n' : ''}`
        process.stdout.write(pad(msg, 90, { colors: true }) + '\r')
    }

    return es.through(function(file) {
        fileList.push(file)
    }, function() {
        var self = this
        try {
            var progTrans = progress.bind(null, fileList.length, 'trans')
            fileList.forEach(function(file, index) {
                progTrans(index)
                doTrans(file)
            })

            var progConcat = progress.bind(null, itemList.length, `concat${opts.minify ? ' & minify' : ''}`)
            itemList.forEach(function(item, index) {
                progConcat(index)
                doConcat(item)
                self.emit('data', item.file)
            })

            this.emit('end')
        } catch (ex) {
            var detail = ex.line ? `(${ex.line})` : ''
            var msg = `${ex.file}${detail}: ${ex.message}`
            this.emit('error', new gutil.PluginError('gulp-cmd-build', msg))
        }
    })
}