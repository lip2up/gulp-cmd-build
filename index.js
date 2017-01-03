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
var _ = require('underscore')
require('colors')
var pad = require('pad')

var defOpts = {
    idleading: '',
    parsers: {
        '.js': require('./lib/jsParser')
        , '.hbs': require('./lib/hbsParser')
        , '.handlebars': require('./lib/hbsParser')
    },
    handlebars: {
        id: 'gallery/handlebars/1.0.2/runtime'
    },
    minify: true,
    lineMax: 70,
    useES6: false
}

var codeOpts = {
    beautify: true,
    comments: true
}
var minifyOpts = {
    fromString: true,
    output: {}
}

module.exports = function(_opts) {
    var opts = extend(true, {}, defOpts, _opts)
    var fileList = []
    var fileMap = {}
    var itemList = []
    var itemMap = {}

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
        var meta = ast.parseFirst(item.astCache)

        var depMap = {}
        var astList = meta.dependencies.reduce(function(list, dep) {
            if (dep[0] == '.') {
                var id = iduri.absolute(meta.id, dep)
                if (!depMap[id]) {
                    depMap[id] = true
                    var item = itemMap[id]
                    if (item) {
                        var astCache = item.astCache
                        var srcId = ast.parseFirst(astCache).id
                        astCache = ast.modify(astCache, function(v) {
                            return v[0] == '.' ? iduri.absolute(srcId, v) : v
                        })
                        list.push(astCache)
                    } else {
                        throw 'cannot find ' + id
                    }
                }
            }
            return list
        }, [ item.astCache ])

        var textList = astList.map(a => a.print_to_string(codeOpts))
        var _source = textList.join('\n\n')
        var astCache = ast.getAst(_source)
        var idList = ast.parse(astCache).map(a => a.id)
        var source = ast.modify(astCache, {
            dependencies: function(v) {
                if (v[0] == '.') {
                    var altId = iduri.absolute(idList[0], v)
                    if (_.contains(idList, altId)) {
                        return v
                    }
                }
                var ext = path.extname(v)
                // remove useless deps
                if (ext && /\.(?:html|txt|tpl|hbs|handlebars|css)$/.test(ext)) {
                    return null
                }

                return v
            }
        })
        .print_to_string(codeOpts)

        var cont = opts.minify ? uglify.minify(source, minifyOpts).code : source
        item.file.contents = new Buffer(cont)
    }

    function progress(total, type, index) {
        var num = Math.floor((index + 1) * 100 / total)
        var msg = `\t${'-> [js]'.green} ${type} ... ${num}%${num == 100 ? '\n' : ''}`
        process.stdout.write(pad(msg, opts.lineMax, { colors: true }) + '\r')
    }

    return es.through(function(file) {
        fileList.push(file)
        fileMap[file.path] = file
    }, function() {
        opts._fileMap = fileMap

        var progTrans = progress.bind(null, fileList.length, 'trans')
        fileList.forEach((file, index) => {
            progTrans(index)
            doTrans(file)
        })

        var progConcat = progress.bind(null, itemList.length, `concat${opts.minify ? ' & minify' : ''}`)
        itemList.forEach((item, index) => {
            progConcat(index)
            doConcat(item)
            this.emit('data', item.file)
        })

        this.emit('end')
    })
}