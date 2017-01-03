// TODO 重写 babel-plugin-transform-es2015-for-of，始终使用最简单的转换方式
// TODO 解决 const list = [ ...str ] 的问题
const babelCore = require('babel-core')

const transOpts = {
    plugins: [
        'transform-es2015-arrow-functions',
        [ 'transform-es2015-template-literals', { loose: true } ],
        'transform-es2015-shorthand-properties',
        [ 'transform-es2015-computed-properties', { loose: true } ],
        'transform-es2015-parameters',
        'transform-es2015-destructuring',
        [ 'transform-es2015-spread', { loose: true } ],
        [ 'transform-object-rest-spread', { useBuiltIns: true } ],
        'transform-function-bind',
        'transform-es2015-block-scoping',
        'transform-es2015-literals',
        'transform-exponentiation-operator',
        [ 'transform-es2015-for-of', { loose: true } ],
        [ 'transform-class-properties', { spec: false } ],
        [ 'transform-es2015-classes', { loose: true } ],
        [ 'transform-runtime', {
            'helpers': true,
            'polyfill': false,
            'regenerator': false,
            'moduleName': 'babel-runtime'
        } ],
    ]
}

const rImport = /import\s+(_[\S]+).*/
const rDefine = /define\s*\(\s*function.*/

function replaceImport(code) {
    const lines = code.split(/\n|\r|\r\n/)
    let defineLine = 'define(function (require) {'
    const newLines = lines.map(line => {
        if (rDefine.test(line)) {
            defineLine = line
            return ''
        }

        return line.replace(rImport, 'var $1 = require("j/ex/es6-runtime").$1')
    })
    return [ defineLine, ...newLines ].join('\n')
}

module.exports = function(code) {
    const { code: dstCode } = babelCore.transform(code, transOpts)
    return replaceImport(dstCode)
}