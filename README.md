我们尝试实现一个React-like库 -- tiny-react

核心概念是增量更新。即如果只有少量元素变化，则只需要对有变化的部分更新。具体概念有：
1. 虚拟DOM(Virtual DOM或vDOM)；一个树状结构，用以对应实际DOM。需要改变DOM时，只需要操作vDOM，tiny-react会做增量更新。
2. diff&patch；对新旧vDOM做diff，得到patches，再在当前的DOM上打补丁（patch）（可参考git的diff&patch加深理解）。



1. 一个简单的例子，演示如何使用
```
renderDOM(createVDOM('div', {}, 'Hello VDOM'), document.getElementById('app'))
```
`renderDOM()`对应`ReactDOM.render()`，`createVDOM()`对应`React.createElement()`
2. vDOM和`createVDOM(...)`
```
function createVDOM(tag, props, ...children) {
    return {
        tag,
        props,
        children
    }
}
```
```
{
    "tag": "div",
    "props": {
        "className": "form"
    },
    "children": [
        {
            "tag": "input",
            "props": {
                "value": "world"
            },
            "children": []
        },
        {
            "tag": "div",
            "props": {},
            "children": [
                "Hello world"
            ]
        }
    ]
}
```
3. `renderDOM(nextVDOM, parent)`
```
function renderDOM(nextVDOM, parent) {
    let prevVDOM = parent._vDOM
    let patches = diff(prevVDOM, nextVDOM, parent)
    patch(patches)
}
```
4. `diff(prevVDOM, nextVDOM, parent)`
只比较当前层，基于React的两个假设
```
function diff(prevVDOM, nextVDOM, parent) {
    if (prevVDOM) {
        nextVDOM._dom = prevVDOM._dom
    }

    parent._vDOM = nextVDOM

    let diffs = []

    let info = {
        prevVDOM,
        nextVDOM,
        parent
    }

    if (!prevVDOM) {
        diffs.push({
            ...info,
            type: 'create'
        })
    } else if (!nextVDOM) {
        diffs.push({
            ...info,
            type: 'remove'
        })
    } else if (isPlainObject(prevVDOM) && isPlainObject(nextVDOM)) {
        if (prevVDOM.tag === nextVDOM.tag) {
            diffs = diffs.concat(diffProps(prevVDOM.props, nextVDOM.props, prevVDOM._dom))

            prevVDOM.children.forEach((prevChild, index) => {
                let nextChild = nextVDOM.children[index]
                diffs = diffs.concat(diff(prevChild, nextChild, prevVDOM._dom))
            })
        } else {
            diffs.push({
                ...info,
                type: 'update'
            })
        }
    } else {
        diffs.push({
            ...info,
            type: 'update'
        })
    }

    return diffs
}
```
5. `patch(patches)`
```
function patch(patches) {
    patches.forEach(patch => {
        let {prevVDOM, nextVDOM, parent} = patch
        if (patch.type === 'create') {
            let dom = createDOM(nextVDOM)
            parent.appendChild(dom)
        } else if (patch.type === 'remove') {
            parent.removeChild(prevVDOM._dom)
        } else if (patch.type === 'update') {
            let dom = createDOM(nextVDOM)
            parent.replaceChild(dom, prevVDOM._dom)
        }

        ...
    })
}

function createDOM(vdom) {
    let dom = null
    if (isPlainObject(vdom)) {
        let {tag, props, children} = vdom
        dom = document.createElement(tag)
        Object.keys(props).forEach(key => {
            dom[key] = props[key]
        })

        children.forEach(child => {
            dom.appendChild(createDOM(child))
        })
    } else {
        dom = document.createTextNode(vdom)
    }

    vdom._dom = dom

    return dom
}
```

