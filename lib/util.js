exports.parseError = function(file, message, line) {
    return {
        file: file
        , message: message
        , line: line
    }
}

exports.removeJs = function(s) {
    return s.replace(/\.js$/, '')
}

exports.unique = function(array) {
    var result = []

    for (var i = 0, len = array.length, map = {}; i < len; i++) {
        var item = array[i]
        if (!(item in map)) {
            map[item] = 1
            result.push(item)
        }
    }

    return result
}

exports.pushList = function(array) {
    var argList = [].slice.call(arguments, 1)
    var list = [].concat.apply([], argList)
    array.splice.apply(array, [ array.length, 0 ].concat(list))
}