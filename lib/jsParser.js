var ast = require('cmd-util').ast
var iduri = require('cmd-util').iduri
var path = require('path')
var parseError = require('./util').parseError
var removeJs = require('./util').removeJs
var fs = require('fs')
var _ = require('underscore')

function getFileContent(fpath, opts) {
    fpath = path.resolve(fpath)
    var fileMap = opts._fileMap
    var file = fileMap[fpath]
    var cont = file
        ? file.contents.toString('utf8')
        : fs.readFileSync(fpath, 'utf8')
    return addDefineIfMissing(cont)
}

function getModuleDeps(id, opts) {
    var alias = iduri.parseAlias(opts, id)
    var fpath = iduri.appendext(alias)

    if ((iduri.isAlias(opts, id) && alias == id)    // usually this is '$'
        || /^text!/.test(id)        // dont resolve text!path/to/some.xx, same as seajs-text
        || !/\.js$/.test(fpath)) {   // dont resolve non-js file
        return []
    }

    if (!fs.existsSync(fpath)) {
        throw parseError(`cannot find module ${alias}`)
    }

    var data = getFileContent(fpath, opts)
    var parsed = ast.parse(data)
    var deps = []
    var ids = parsed.map(m => m.id)
    parsed.forEach(function(meta) {
        meta.dependencies.forEach(function(_dep) {
            var dep = iduri.absolute(alias, _dep)
            if (!_.contains(deps, dep) && !_.contains(ids, dep)
                && !_.contains(ids, removeJs(dep))) {
                deps.push(dep)
            }
        })
    })
    return deps
}

function parseDeps(fpath, opts) {
    var rootpath = fpath

    function relativeDeps(fpath, opts, basefile) {
        if (basefile) {
            fpath = path.join(path.dirname(basefile), fpath)
        }
        fpath = iduri.appendext(fpath)

        if (!fs.existsSync(fpath)) {
            throw parseError('cannot find ' + fpath, rootpath)
        }

        var deps = []

        try {
            var data = getFileContent(fpath, opts)
            var parsed = ast.parseFirst(data)
        } catch (ex) {
            throw parseError(ex.message, fpath, ex.line)
        }
        var moduleDeps = {}
        parsed.dependencies.forEach(function(_id) {
            var id = removeJs(_id)
            if (id[0] == '.') {
                // fix nested relative deps
                if (basefile) {
                    var altId = path.join(path.dirname(fpath), id)
                    altId = path.relative(path.dirname(rootpath), altId)
                    altId[0] != '.' && (altId = './' + altId)
                    deps.push(altId)
                } else {
                    deps.push(id)
                }
                if (/\.js$/.test(iduri.appendext(id))) {
                    deps = _.union(deps, relativeDeps(id, opts, fpath))
                }
            } else if (!moduleDeps[id]) {
                var alias = iduri.parseAlias(opts, id)
                deps.push(alias)

                // dont parse no javascript deps
                var ext = path.extname(alias)
                if (ext && ext != '.js') return

                var mdeps = getModuleDeps(id, opts)
                moduleDeps[id] = mdeps
                deps = _.union(deps, mdeps)
            }
        })
        return deps
    }

    return relativeDeps(fpath, opts)
}

function addDefineIfMissing(str) {
    var rDefine = /define\s*\(\s*function/
    return rDefine.test(str) ? str : `define(function(require) { ${str} })`
}

module.exports = function(file, opts) {
    var data = addDefineIfMissing(file.contents.toString('utf8'))

    try {
        var astCache = ast.getAst(data)
    } catch (ex) {
        throw parseError(ex.message, file.path, ex.line)
    }

    var meta = ast.parseFirst(astCache)
    if (!meta) {
        throw parseError('not cmd module', file.path)
    }

    var deps, depsSpec
    if (meta.dependencyNode) {
        deps = meta.dependencies
        depsSpec = true
    } else {
        deps = parseDeps(file.path, opts)
    }

    var filename = path.relative(file.cwd, file.path)
    var id = meta.id ? meta.id : opts.idleading + removeJs(filename)
    astCache = ast.modify(astCache, {
        id: id
        , dependencies: deps
        , require: function(v) {
            // ignore when deps is specified by developer
            return depsSpec ? v : iduri.parseAlias(opts, v)
        }
    })

    return {
        id: id
        , deps: deps
        , file: file
        , astCache: astCache
    }
}