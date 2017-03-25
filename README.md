TinyReact是一个极小的React-like库，用来演示React的工作原理。

TinyReact绝大部分思路来源于[Building Your Own React Clone in Five Easy Steps](https://blog.javascripting.com/2016/10/05/building-your-own-react-clone-in-five-easy-steps/)。实现上略有区别。

[Demo看这里](https://sunhuawei.github.io/TinyReact/)

## 前言

由于React要兼顾各种场景，其代码难免难以阅读。本文以**仅120行源代码的库TinyReact**演示React的核心概念vDOM和vDOM diff。

## 原理

React的核心本质上是增量更新。也就是说在初始化时会构建整个DOM Tree。之后如果有任何数据变化时，只需要更新变化了的部分。

为了跟踪变化，React引入了Element（Virtual DOM或者vDOM或者虚拟DOM）的概念。且在每次渲染时保留完整的vDOM。并在更新时比较本次生成的vDOM与上次的差异，这个过程叫做diff。然后根据差异对已有DOM作修改，这个过程叫patch（可参考git的diff&patch加深理解）。

我们对照React的例子来逐步构建TinyReact。

## 一个简单的例子，演示我们是如何使用TinyReact的

在React中，如果不用jsx，一般写法是这样

```javascript
ReactDOM.render(React.createElement('div', {}, 'Hello TinyReact'), document.getElementById('app'))
```

在TinyReact中，`renderDOM()`对应`ReactDOM.render()`，`createVDOM()`对应`React.createElement()`

```javascript
renderDOM(createVDOM('div', {}, 'Hello TinyReact'), document.getElementById('app'))
```

## `createVDOM(...)`

`createVDOM(...)`会够建一个Plain Object。

```javascript
function createVDOM(tag, props, ...children) {
    return {
        tag,
        props,
        children // 递归结构
    }
}
```

我们的html（DOM）通常是多层嵌套的，所以vDOM通常也是一个递归结构，如：

```javascript
{
  "tag": "div",
  "props": {className: 'root'},
  "children": [
    {
      "tag": "div",
      "props": {className: 'inner'},
      "children": [
        {
          "tag": "input",
          "props": {},
          "children": []
        },
      ]
    }
  ]
}
```

## `renderDOM(nextVDOM, parent)`

将vDOM渲染到rootDOM节点下。

```javascript
function renderDOM(nextVDOM, rootDOM) {
    let prevVDOM = rootDOM._vDOM
    rootDOM._vDOM = nextVDOM                                   // 将新的vDOM保存下来
    let patches = diff(prevVDOM, nextVDOM, rootDOM)
    console.log(patches) // Show what patches will be applied
    patch(patches)
}
```

参照以上代码

- 初次访问`renderDOM()`，prevVDOM为空，会根据nextVDOM创建整个DOM Tree。
- 再次访问`renderDOM()`，prevVDOM为之前的vDOM，会根据`diff()`的结果做增量更新(patch)。

## `diff(prevVDOM, nextVDOM, parent)`

完整比较两棵树的时间复杂度为O(n3)。实际上这在前端是不可接受的。

React基于以下两个`假设`（assumptions）将复杂度降低到了O(n)。

> 1. Two components of the same class will generate similar trees and two components of different classes will generate different trees.
> 2. It is possible to provide a unique key for elements that is stable across different renders.

根据第一个假设，只需要逐层比较，不用比较不同层级。如果标签（tag）不同，就会新建DOM并替换掉旧的DOM。
*我们暂时不考虑第二个假设。为了简化问题，我们假设各元素在数组中的位置不会发生变化*

```javascript
function diff(prevVDOM, nextVDOM, parent) {
  if (prevVDOM && nextVDOM) {
    nextVDOM._dom = prevVDOM._dom
  }

  let diffs = []
  if (!prevVDOM) {
    diffs.push({type: 'create', prevVDOM, nextVDOM, parent})
  } else if (!nextVDOM) {
    diffs.push({type: 'remove', prevVDOM, nextVDOM, parent})
  } else if (isPlainObject(prevVDOM) && isPlainObject(nextVDOM)) {
    if (prevVDOM.tag === nextVDOM.tag) {
      ...
    } else {
      diffs.push({type: 'update', prevVDOM, nextVDOM, parent})
    }
  } else if (prevVDOM !== nextVDOM) {
    diffs.push({type: 'update', prevVDOM, nextVDOM, parent})
  }

  return diffs
}
```

`diff()`会返回一个patch对象数组，用以表示有哪些变动。patch对象结构如下：

```javascript
{
  type,
  prevVDOM,
  nextVDOM,
  parent
}
```

## 属性值变化

标签（tag）相同的情况下，比较属性值是否有变化

```javascript
diffs = diffs.concat(diffProps(prevVDOM.props, nextVDOM.props, prevVDOM._dom))
```

```javascript
function diffProps(prevProps = [], nextProps = [], dom) {
  return Object.keys(prevProps).reduce((diffs, key) => {
    if (prevProps[key] !== nextProps[key]) {
      diffs.push({
        dom,
        key,
        value: nextProps[key],
        type: 'updateProp'
      })
    }

    return diffs
  }, [])
}
```

该部分返回的patch略有不同。

## 子节点（children）变化

标签（tag）相同的情况下，要检测子节点（children）的变化。

为了简化问题，我们假设各元素在数组中的位置不会发生变化。

```javascript
let checkedIndex = -1
;(prevVDOM.children || []).forEach((prevChild, index) => {
  checkedIndex = index
  let nextChild = (nextVDOM.children || [])[index]
  diffs = diffs.concat(diff(prevChild, nextChild, prevVDOM._dom))
})

;(nextVDOM.children || []).forEach((nextChild, index) => {
  if (checkedIndex >= index) return
  let prevChild = (prevVDOM.children || [])[index]
  diffs = diffs.concat(diff(prevChild, nextChild, prevVDOM._dom))
})
```

可以发现这里递归调用了`diff()`，这样一次遍历完整个vDOM Tree就可以得到所有的patches。

## `patch(patches)`增量更新

```javascript
function patch(patches) {
  patches.forEach(patch => {
    let {prevVDOM, nextVDOM, parent} = patch
    if (patch.type === 'create') {            // 创建新的DOM对象，并添加
      let dom = createDOM(nextVDOM)
      parent.appendChild(dom)
    } else if (patch.type === 'remove') {     // 直接移除DOM
      parent.removeChild(prevVDOM._dom)
    } else if (patch.type === 'update') {     // 创建新DOM并替换
      let dom = createDOM(nextVDOM)
      parent.replaceChild(dom, prevVDOM._dom)
    } else if (patch.type === 'updateProp') { // 属性修改
      patch.dom[patch.key] = patch.value
    }
  })
}
```

有两种类型的DOM，一种是用Plain Object表示的vDOM，另一种是string表示的文本节点。

```javascript
function createDOM(vdom) {
  let dom = null
  if (isPlainObject(vdom)) {
    let {tag, props = {}, children = []} = vdom
    dom = document.createElement(tag)
    children.forEach(child => {
      dom.appendChild(createDOM(child))  // 递归创建子节点
    })

    Object.keys(props).forEach(key => {
      dom[key] = props[key]
    })
  } else {
    dom = document.createTextNode(vdom)
  }

  vdom._dom = dom

  return dom
}
```

完整的代码在[index.js](./index.js)，也可以查看这个[Demo](https://sunhuawei.github.io/TinyReact/)。

## 结束语

这是一个极其简化的实现，只是为了演示主要流程，很多问题并没有考虑。进一步建议阅读[preact](https://github.com/developit/preact)及[inferno](https://github.com/infernojs/inferno)的源码，这两个库相对React来说还是简单不少。

欢迎各种PR和Issue。

