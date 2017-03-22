function createVDOM(tag, props, ...children) {
  return {
    tag,
    props,
    children: children.map(child =>  {
      // string => String Object
      return isPlainObject(child) ? child: new String(child)
    })
  }
}

function renderDOM(nextVDOM, parent) {
  let prevVDOM = parent._vDOM
  let patches = diff(prevVDOM, nextVDOM, parent)
  patch(patches)
}

function diff(prevVDOM, nextVDOM, parent) {
  parent._vDOM = nextVDOM
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
      diffs = diffs.concat(diffProps(prevVDOM.props, nextVDOM.props, prevVDOM._dom))

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
    } else {
      diffs.push({type: 'update', prevVDOM, nextVDOM, parent})
    }
  } else {
    diffs.push({type: 'update', prevVDOM, nextVDOM, parent})
  }

  return diffs
}

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

function isPlainObject(target) {
  return Object.prototype.toString.call(target) === '[object Object]'
}

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
    } else if (patch.type === 'updateProp') {
      patch.dom[patch.key] = patch.value
    }
  })
}

function createDOM(vdom) {
  let dom = null
  if (isPlainObject(vdom)) {
    let {tag, props = {}, children = []} = vdom
    dom = document.createElement(tag)
    children.forEach(child => {
      dom.appendChild(createDOM(child))
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

if (typeof module !== 'undefined') {
  module.exports.createVDOM = createVDOM
  module.exports.renderDOM = renderDOM
}
