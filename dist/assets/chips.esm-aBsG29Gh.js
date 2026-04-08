import{r as s,ai as be,aj as ge,ak as ke,al as we,an as w,ar as O,ao as Ie,as as R,at as Oe,av as Pe,aT as H}from"./index-oOpKcIkc.js";import{T as xe}from"./index.esm-CQeTDq5y.js";function P(t){"@babel/helpers - typeof";return P=typeof Symbol=="function"&&typeof Symbol.iterator=="symbol"?function(r){return typeof r}:function(r){return r&&typeof Symbol=="function"&&r.constructor===Symbol&&r!==Symbol.prototype?"symbol":typeof r},P(t)}function _e(t,r){if(P(t)!="object"||!t)return t;var a=t[Symbol.toPrimitive];if(a!==void 0){var l=a.call(t,r);if(P(l)!="object")return l;throw new TypeError("@@toPrimitive must return a primitive value.")}return(r==="string"?String:Number)(t)}function Se(t){var r=_e(t,"string");return P(r)=="symbol"?r:r+""}function Ce(t,r,a){return(r=Se(r))in t?Object.defineProperty(t,r,{value:a,enumerable:!0,configurable:!0,writable:!0}):t[r]=a,t}function h(){return h=Object.assign?Object.assign.bind():function(t){for(var r=1;r<arguments.length;r++){var a=arguments[r];for(var l in a)({}).hasOwnProperty.call(a,l)&&(t[l]=a[l])}return t},h.apply(null,arguments)}function K(t,r){(r==null||r>t.length)&&(r=t.length);for(var a=0,l=Array(r);a<r;a++)l[a]=t[a];return l}function De(t){if(Array.isArray(t))return K(t)}function Re(t){if(typeof Symbol<"u"&&t[Symbol.iterator]!=null||t["@@iterator"]!=null)return Array.from(t)}function J(t,r){if(t){if(typeof t=="string")return K(t,r);var a={}.toString.call(t).slice(8,-1);return a==="Object"&&t.constructor&&(a=t.constructor.name),a==="Map"||a==="Set"?Array.from(t):a==="Arguments"||/^(?:Ui|I)nt(?:8|16|32)(?:Clamped)?Array$/.test(a)?K(t,r):void 0}}function Ee(){throw new TypeError(`Invalid attempt to spread non-iterable instance.
In order to be iterable, non-array objects must have a [Symbol.iterator]() method.`)}function C(t){return De(t)||Re(t)||J(t)||Ee()}function Ae(t){if(Array.isArray(t))return t}function Te(t,r){var a=t==null?null:typeof Symbol<"u"&&t[Symbol.iterator]||t["@@iterator"];if(a!=null){var l,e,b,g,d=[],v=!0,x=!1;try{if(b=(a=a.call(t)).next,r!==0)for(;!(v=(l=b.call(a)).done)&&(d.push(l.value),d.length!==r);v=!0);}catch(_){x=!0,e=_}finally{try{if(!v&&a.return!=null&&(g=a.return(),Object(g)!==g))return}finally{if(x)throw e}}return d}}function je(){throw new TypeError(`Invalid attempt to destructure non-iterable instance.
In order to be iterable, non-array objects must have a [Symbol.iterator]() method.`)}function U(t,r){return Ae(t)||Te(t,r)||J(t,r)||je()}var Ke=`
@layer primereact {
    .p-chips {
        display: inline-flex;
    }
    
    .p-chips-multiple-container {
        margin: 0;
        padding: 0;
        list-style-type: none;
        cursor: text;
        overflow: hidden;
        display: flex;
        align-items: center;
        flex-wrap: wrap;
    }
    
    .p-chips-token {
        cursor: default;
        display: inline-flex;
        align-items: center;
        flex: 0 0 auto;
    }
    
    .p-chips-input-token {
        flex: 1 1 auto;
        display: inline-flex;
    }
    
    .p-chips-token-icon {
        cursor: pointer;
    }
    
    .p-chips-input-token input {
        border: 0 none;
        outline: 0 none;
        background-color: transparent;
        margin: 0;
        padding: 0;
        box-shadow: none;
        border-radius: 0;
        width: 100%;
    }
    
    .p-fluid .p-chips {
        display: flex;
    }
    
    .p-chips-icon-left,
    .p-chips-icon-right {
        position: relative;
        display: inline-block;
    }
    
    .p-chips-icon-left > i,
    .p-chips-icon-right > i,
    .p-chips-icon-left > svg,
    .p-chips-icon-right > svg,
    .p-chips-icon-left > .p-chips-prefix,
    .p-chips-icon-right > .p-chips-suffix {
        position: absolute;
        top: 50%;
        margin-top: -0.5rem;
    }
    
    .p-fluid .p-chips-icon-left,
    .p-fluid .p-chips-icon-right {
        display: block;
        width: 100%;
    }
}
`,Fe={removeTokenIcon:"p-chips-token-icon",label:"p-chips-token-label",token:function(r){var a=r.focusedIndex,l=r.index;return R("p-chips-token",{"p-focus":a===l})},inputToken:"p-chips-input-token",container:function(r){var a=r.props,l=r.context;return R("p-inputtext p-chips-multiple-container",{"p-variant-filled":a.variant?a.variant==="filled":l&&l.inputStyle==="filled"})},root:function(r){var a=r.isFilled,l=r.focusedState,e=r.disabled,b=r.invalid;return R("p-chips p-component p-inputwrapper",{"p-inputwrapper-filled":a,"p-inputwrapper-focus":l,"p-disabled":e,"p-invalid":b,"p-focus":l})}},D=ke.extend({defaultProps:{__TYPE:"Chips",addOnBlur:null,allowDuplicate:!0,ariaLabelledBy:null,autoFocus:!1,className:null,disabled:null,id:null,inputId:null,inputRef:null,invalid:!1,variant:null,itemTemplate:null,keyfilter:null,max:null,name:null,onAdd:null,onBlur:null,onChange:null,onFocus:null,onKeyDown:null,onRemove:null,placeholder:null,readOnly:!1,removable:!0,removeIcon:null,separator:null,style:null,tooltip:null,tooltipOptions:null,value:null,children:void 0},css:{classes:Fe,styles:Ke}});function W(t,r){var a=Object.keys(t);if(Object.getOwnPropertySymbols){var l=Object.getOwnPropertySymbols(t);r&&(l=l.filter(function(e){return Object.getOwnPropertyDescriptor(t,e).enumerable})),a.push.apply(a,l)}return a}function z(t){for(var r=1;r<arguments.length;r++){var a=arguments[r]!=null?arguments[r]:{};r%2?W(Object(a),!0).forEach(function(l){Ce(t,l,a[l])}):Object.getOwnPropertyDescriptors?Object.defineProperties(t,Object.getOwnPropertyDescriptors(a)):W(Object(a)).forEach(function(l){Object.defineProperty(t,l,Object.getOwnPropertyDescriptor(a,l))})}return t}var Be=s.memo(s.forwardRef(function(t,r){var a=be(),l=s.useContext(ge),e=D.getProps(t,l),b=s.useState(!1),g=U(b,2),d=g[0],v=g[1],x=s.useState(null),_=U(x,2),m=_[0],S=_[1],E=D.setMetaData({props:e,state:{focused:d}}),y=E.ptm,k=E.cx,X=E.isUnstyled;we(D.css.styles,X,{name:"chips"});var F=s.useRef(null),B=s.useRef(null),p=s.useRef(e.inputRef),A=function(n,o){if(!(e.disabled||e.readOnly)){var i=C(e.value),u=i.splice(o,1)[0];$(u,o)&&(e.onRemove&&e.onRemove({originalEvent:n,value:u}),e.onChange&&e.onChange({originalEvent:n,value:i,stopPropagation:function(){n?.stopPropagation()},preventDefault:function(){n?.preventDefault()},target:{name:e.name,id:e.id,value:i}}))}},T=function(n,o,i){if(o&&o.trim().length){var u=e.value?C(e.value):[];if(e.allowDuplicate||u.indexOf(o)===-1){var f=!0;e.onAdd&&(f=e.onAdd({originalEvent:n,value:o})),f!==!1&&u.push(o)}N(n,u,i)}},Y=function(){O.focus(p.current)},q=function(n){switch(n.code){case"ArrowLeft":G();break;case"ArrowRight":Q();break;case"Backspace":Z(n);break}},G=function(){var n=m;p.current.value.length===0&&e.value&&e.value.length>0&&(n=n===null?e.value.length-1:n-1,n<0&&(n=0)),S(n)},Q=function(){var n=m;p.current.value.length===0&&e.value&&e.value.length>0&&(n===e.value.length-1?(n=null,p.current.focus()):n++),S(n)},Z=function(n){m!==null&&A(n,m)},V=function(n){var o=n.target.value,i=e.value||[];if(e.onKeyDown&&e.onKeyDown(n),!n.defaultPrevented)switch(n.key){case"Backspace":o.length===0&&i.length>0&&A(n,i.length-1);break;case"Enter":o&&o.trim().length&&(!e.max||e.max>i.length)&&T(n,o,!0);break;case"ArrowLeft":o.length===0&&i&&i.length>0&&O.focus(B.current);break;case"ArrowRight":n.stopPropagation();break;default:e.keyfilter&&H.onKeyPress(n,e.keyfilter),L()&&n.preventDefault();break}},N=function(n,o,i){e.onChange&&e.onChange({originalEvent:n,value:o,stopPropagation:function(){n?.stopPropagation()},preventDefault:function(){n?.preventDefault()},target:{name:e.name,id:e.id,value:o}}),p.current.value="",i&&n.preventDefault()},ee=function(n){var o,i=(o=n.target.value)===null||o===void 0?void 0:o.trim();if(i===e.separator){p.current.value="";return}if(e.separator&&i.endsWith(e.separator)){var u=i.slice(0,-1);T(n,u)}},ne=function(n){if(e.separator){var o=e.separator.replace("\\n",`
`).replace("\\r","\r").replace("\\t","	"),i=(n.clipboardData||window.clipboardData).getData("Text");if(e.keyfilter&&H.onPaste(n,e.keyfilter),i){var u=e.value||[],f=i.split(o);f=f.filter(function(I){return(e.allowDuplicate||u.indexOf(I)===-1)&&I.trim().length}),u=[].concat(C(u),C(f)),N(n,u,!0)}}},te=function(){v(!0)},re=function(){S(-1),v(!1)},ae=function(n){v(!0),S(null),e.onFocus&&e.onFocus(n)},oe=function(n){if(e.addOnBlur){var o=n.target.value,i=e.value||[];o&&o.trim().length&&(!e.max||e.max>i.length)&&T(n,o,!0)}v(!1),e.onBlur&&e.onBlur(n)},L=function(){return e.max&&e.value&&e.max===e.value.length},M=p.current&&p.current.value,ie=s.useMemo(function(){return w.isNotEmpty(e.value)||w.isNotEmpty(M)},[e.value,M]),$=function(n,o){return w.getPropValue(e.removable,{value:n,index:o,props:e})};s.useImperativeHandle(r,function(){return{props:e,focus:function(){return O.focus(p.current)},getElement:function(){return F.current},getInput:function(){return p.current}}}),s.useEffect(function(){w.combinedRefs(p,e.inputRef)},[p,e.inputRef]),Ie(function(){e.autoFocus&&O.focus(p.current,e.autoFocus)});var le=function(){return m!==null?"".concat(e.inputId,"_chips_item_").concat(m):null},ue=function(n,o){if(!e.disabled&&!e.readOnly&&$(n,o)){var i=a({className:k("removeTokenIcon"),onClick:function(j){return A(j,o)},"aria-hidden":"true"},y("removeTokenIcon")),u=e.removeIcon||s.createElement(xe,h({},i,{key:"".concat(o,"_icon")})),f=Pe.getJSXIcon(u,z({},i),{props:e});return f}return null},ce=function(n,o){var i=e.itemTemplate?e.itemTemplate(n):n,u=a({className:k("label")},y("label")),f=s.createElement("span",h({},u,{key:"".concat(o,"_").concat(n,"_span")}),i),I=ue(n,o),j=a({id:e.inputId+"_chips_item_"+o,role:"option","aria-label":n,className:k("token",{focusedIndex:m,index:o}),"aria-selected":!0,"aria-setsize":e.value.length,"aria-posinset":o+1,"data-p-highlight":!0,"data-p-focused":m===o},y("token"));return s.createElement("li",h({},j,{key:"".concat(o,"_").concat(n)}),f,I)},se=function(){var n=a({className:k("inputToken")},y("inputToken")),o=a(z({id:e.inputId,ref:p,placeholder:e.placeholder,type:"text",enterKeyHint:"enter",name:e.name,disabled:e.disabled||L(),onKeyDown:function(u){return V(u)},onChange:function(u){return ee(u)},onPaste:function(u){return ne(u)},onFocus:function(u){return ae(u)},onBlur:function(u){return oe(u)},readOnly:e.readOnly},me),y("input"));return s.createElement("li",h({},n,{key:e.inputId+"_chips_input"}),s.createElement("input",o))},pe=function(){return e.value?e.value.map(ce):null},fe=function(){var n=pe(),o=se(),i=a({ref:B,className:k("container",{context:l}),onClick:function(f){return Y()},onKeyDown:function(f){return q(f)},tabIndex:-1,role:"listbox","aria-orientation":"horizontal","aria-labelledby":e.ariaLabelledby,"aria-label":e.ariaLabel,"aria-activedescendant":d?le():void 0,"data-p-disabled":e.disabled,"data-p-focus":d,onFocus:te,onBlur:re},y("container"));return s.createElement("ul",i,n,o)},de=w.isNotEmpty(e.tooltip),ve=D.getOtherProps(e),me=w.reduceKeys(ve,O.ARIA_PROPS),ye=fe(),he=a({id:e.id,ref:F,className:R(e.className,k("root",{isFilled:ie,focusedState:d,disabled:e.disabled,invalid:e.invalid})),style:e.style},y("root"));return s.createElement(s.Fragment,null,s.createElement("div",h({},he,{key:"chips"}),ye),de&&s.createElement(Oe,h({target:p,content:e.tooltip,pt:y("tooltip")},e.tooltipOptions)))}));Be.displayName="Chips";export{Be as C};
