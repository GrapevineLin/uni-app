const t = require('@babel/types')
const babelTraverse = require('@babel/traverse').default
const parser = require('@babel/parser')
const {
  getBabelParserOptions
} = require('@dcloudio/uni-cli-shared/lib/platform')

const {
  getCode
} = require('@dcloudio/uni-template-compiler/lib/util')

function handleObjectExpression (contentObj, path, state, ast) {
  const properties = path.container.value.properties
  let list = ''
  const componentNodes = []

  properties.forEach(_ => {
    const name = _.key.value.replace(/\-(\w)/g, function (all, letter) {
      return letter.toUpperCase()
    })
    const value = _.value.value
    const asyncCustomComponentsToImport = `import ${name} from '${'@' + value}';`
    list += asyncCustomComponentsToImport

    // 创建组件节点，使用 t.identifier 而不是 parser.parseExpression
    const node = t.objectProperty(t.identifier(name), t.identifier(name))
    componentNodes.push(node)
  })

  // 获取 ExportDefaultDeclaration 节点
  const idx = ast.program.body.findIndex(_ => _.type === 'ExportDefaultDeclaration')
  const ExportDefaultDeclarationNode = ast.program.body[idx]

  // 解析 import 语句
  if (list) {
    const nodes = parser.parse(list, getBabelParserOptions()).program.body
    ast.program.body.splice(idx, 0, ...nodes)
  }

  const componentIdx = ExportDefaultDeclarationNode.declaration.properties.findIndex(_ => _.key.name === 'components' || _.key.value === 'components')
  if (componentIdx === -1) {
    const _node = parser.parse('const a = {components: {}}', getBabelParserOptions()).program.body
    const comNode = _node[0]?.declarations[0]?.init?.properties[0]
    const asyncComponentIdx = ExportDefaultDeclarationNode.declaration.properties.findIndex(_ => _.key.name === 'asyncCustomComponents')
    ExportDefaultDeclarationNode.declaration.properties.splice(asyncComponentIdx, 0, comNode)
  }
  const _componentIdx = ExportDefaultDeclarationNode.declaration.properties.findIndex(_ => _.key.name === 'components' || _.key.value === 'components')
  if (_componentIdx !== -1) {
    const componentNode = ExportDefaultDeclarationNode.declaration.properties[_componentIdx]
    componentNode.value.properties.splice(0, 0, ...componentNodes)
  }

  const content = getCode(ast)
  contentObj.content = content
}

module.exports = function (content, state = {
  type: 'Component',
  components: [],
  options: {}
}) {
  const contentObj = {}
  const ast = parser.parse(content, getBabelParserOptions())
  babelTraverse(ast, {
    enter (path) {
      if (path.isIdentifier({ name: 'asyncCustomComponents' })) {
        handleObjectExpression(contentObj, path, state, ast)
      }
    }
  })
  return {
    content: contentObj.content,
    state
  }
}
