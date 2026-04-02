/* eslint-disable no-unused-vars */


export function itemRender(_currentp, type, originalElement) {
  if (type === "prev") {
    return <a>Previous</a>;
  }
  if (type === "next") {
    return <a>Next</a>;
  }
  return originalElement;
}

export function onShowSizeChange(_current, _pageSize) {

  // console.log(current, pageSize);
}