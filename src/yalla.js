(function (root, factory) {
    if (typeof define === "function" && define.amd) {
        define([], factory);
    } else if (typeof module === "object" && module.exports) {
        module.exports = factory();
    } else {
        root.yalla = factory();
        root.Context = root.Context || root.yalla.Context;
        root.render = root.render || root.yalla.render;
        root.plug = root.plug || root.yalla.plug;
        root.uuidv4 = root.uuidv4 || root.yalla.uuidv4;
        root.Event = root.Event || root.yalla.Event;
    }
}(typeof self !== "undefined" ? self : eval("this"), function () {
    /*
     The MIT License (MIT)

     Copyright (c) 2017-present, Arif Rachim

     Permission is hereby granted, free of charge, to any person obtaining a copy
     of this software and associated documentation files (the "Software"), to deal
     in the Software without restriction, including without limitation the rights
     to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
     copies of the Software, and to permit persons to whom the Software is
     furnished to do so, subject to the following conditions:

     The above copyright notice and this permission notice shall be included in
     all copies or substantial portions of the Software.

     THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
     IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
     FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
     AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
     LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
     OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
     THE SOFTWARE.
     */

    let isChrome = "chrome" in window && "webstore" in window.chrome;

    const Event = {
        SYNCING_DONE : "syncingdone"
    };

    const cloneNodeTree = (node) => {
        if (isChrome) {
            return node.cloneNode(true);
        } else {
            let clone = node.nodeType === 3 ? document.createTextNode(node.nodeValue) : node.cloneNode(false);
            let child = node.firstChild;
            while (child) {
                clone.appendChild(cloneNodeTree(child));
                child = child.nextSibling;
            }
            return clone;
        }
    };

    const isPromise = (object) => {
        return (typeof object === "object" && "constructor" in object && object.constructor.name === "Promise");
    };

    const uuidv4 = () => "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
        const r = Math.random() * 16 | 0, v = c === "x" ? r : (r & 0x3 | 0x8);
        return v.toString(16);
    });

    class Template {
        destroy() {
            throw new Error("Please implement template.destroy ");
        }
    }

    const attributeReflectToPropsMap = {
        "INPUT": ["VALUE"]
    };

    const attributeChangesReflectToProperties = (attributeName, nodeName) => {
        attributeName = attributeName.toUpperCase();
        nodeName = nodeName.toUpperCase();
        return attributeReflectToPropsMap[nodeName] ? attributeReflectToPropsMap[nodeName].indexOf(attributeName) >= 0 : false;
    };

    const parentTagMap = {
        "col": "colgroup",
        "td": "tr",
        "area": "map",
        "tbody": "table",
        "tfoot": "table",
        "th": "tr",
        "thead": "table",
        "tr": "tbody",
        "caption": "table",
        "colgroup": "table",
        "li": "ul",
        "g": "svg",
        "circle": "svg",
        "rect": "svg",
        "polygon": "svg",
        "eclipse": "svg",
        "text": "svg"
    };


    const isMinimizationAttribute = (node) => {
        return ["checked", "compact", "declare", "defer", "disabled", "ismap",
                "noresize", "noshade", "nowrap", "selected"].indexOf(node.nodeName) >= 0;
    };

    const getPath = (node) => {
        if (node.nodeType === Node.ATTRIBUTE_NODE) {
            return getPath(node.ownerElement).concat([{name: node.nodeName}]);
        }
        let i = 0;
        let child = node;
        while ((child = child.previousSibling) !== null) {
            i++;
        }
        let path = [];
        path.push(i);
        if (node.parentNode && node.parentNode.parentNode) {
            return getPath(node.parentNode).concat(path);
        }
        return path;
    };


    const getNode = (path, documentFragment) => {
        return path.reduce((content, path) => {
            if (typeof path === "number") {
                return content.childNodes[path];
            } else {
                return content.attributes[path.name];
            }
        }, documentFragment);

    };


    const buildActualAttributeValue = (nodeValue, valueIndexes, templateValues) => {
        let actualAttributeValue = nodeValue;
        let valFiltered = valueIndexes.map(valueIndex => templateValues[(valueIndex)]);
        valueIndexes.forEach((valueIndex, index) => {
            actualAttributeValue = actualAttributeValue.replace(`<!--${valueIndex}-->`, valFiltered[index]);
        });
        return actualAttributeValue;
    };

    class HtmlTemplateCollection extends Template {
        constructor(items, keyFn, templateFn, context) {
            super();
            this.items = items;
            this.keyFn = typeof keyFn === "string" ? ((item) => item[keyFn]) : keyFn;
            this.templateFn = templateFn;
            this.context = context;
            this.keys = [];
            this.templates = {};
            this.initialzed = false;
        }

        iterateRight(callback) {
            if (!this.initialzed) {
                let index = this.items.length - 1;
                while (index >= 0) {
                    let item = this.items[index];
                    let key = this.keyFn.apply(this, [item, index]);
                    let template = this.templateFn.apply(this, [item, index]);
                    if (callback) {
                        callback.apply(null, [item, key, template, index]);
                    }
                    index--;
                    this.keys.push(key);
                    this.templates[key] = template;
                }
                this.initialzed = true;
                this.keys.reverse();
            } else {
                let index = this.keys.length - 1;
                while (index >= 0) {
                    let item = this.items[index];
                    let key = this.keys[index];
                    let template = this.templates[key];
                    if (callback) {
                        callback.apply(null, [item, key, template, index]);
                    }
                    index--;
                }
            }
        }
    }

    const isMatch = (newActualValues, values) => {
        if (newActualValues === values) {
            return true;
        } else if (Array.isArray(newActualValues) && Array.isArray(values) && newActualValues.length === values.length) {
            let isMatch = true;
            for (let i = 0; i < values.length; i++) {
                isMatch = isMatch && (newActualValues[i] === values[i]);
                if (!isMatch) {
                    return false;
                }
            }
            return true;
        }
        return false;
    };

    class Marker {

        constructor(node) {
            this.node = node;
            this.attributes = {};
        }

        static from(node) {
            let element = node;
            if (node.nodeType === Node.ATTRIBUTE_NODE) {
                element = node.ownerElement;
            }
            element.$data = element.$data || new Marker(element);
            return element.$data;
        }
    }

    class HtmlTemplate extends Template {
        constructor(strings, values, context) {
            super();
            this.strings = strings;
            this.values = values;
            this.context = context;
            this.key = this.strings.join("").trim();
            this.nodeValueIndexArray = null;
            this.documentFragment = null;
        }

        static lookNodeValueArray(nodeValue) {
            let result = [];
            let pointerStart = nodeValue.indexOf("<!--");
            let pointerEnd = nodeValue.indexOf("-->", pointerStart);

            while (pointerEnd < nodeValue.length && pointerEnd >= 0 && pointerStart >= 0) {
                result.push(nodeValue.substring((pointerStart + 4), pointerEnd));
                pointerStart = nodeValue.indexOf("<!--", (pointerEnd + 3));
                pointerEnd = nodeValue.indexOf("-->", pointerStart);
            }
            return result;
        }

        static getProperTemplateTag(contentText) {
            let openTag = contentText.substring(1, contentText.indexOf(">"));
            openTag = (openTag.indexOf(" ") > 0 ? openTag.substring(0, openTag.indexOf(" ")) : openTag).toLowerCase();
            let rootTag = parentTagMap[openTag];
            rootTag = rootTag || "div";
            let template = rootTag === "svg" ? document.createElementNS("http://www.w3.org/2000/svg","svg") : document.createElement(rootTag);
            template.innerHTML = contentText;
            return template;
        }

        static applyValues(nextHtmlTemplate, nodeValueIndexArray) {
            let newValues = nextHtmlTemplate.values;
            let context = nextHtmlTemplate.context;
            if (!nodeValueIndexArray) {
                return;
            }

            nodeValueIndexArray.forEach((nodeValueIndex) => {
                let {node, valueIndexes, values} = nodeValueIndex;
                let newActualValues = Array.isArray(valueIndexes) ? valueIndexes.map((valueIndex) => newValues[(valueIndex)]) : newValues[valueIndexes];

                let nodeName = node.nodeName;
                let isEvent = node.nodeType === Node.ATTRIBUTE_NODE && nodeName.indexOf("on") === 0;

                // if values are match, or ifts named eventListener then we dont need to perform update
                if (isMatch(newActualValues, values) || (isEvent && newActualValues[0].name)) {
                    return;
                }
                if (node.nodeType === Node.ATTRIBUTE_NODE) {
                    let marker = Marker.from(node);
                    let nodeValue = nodeValueIndex.nodeValue;
                    if (isEvent) {
                        let valueIndex = valueIndexes[0];
                        node.ownerElement[nodeName] = newValues[valueIndex];
                        marker.attributes[nodeName] = newValues[valueIndex];
                    } else {
                        let plugOrPromiseValue = newValues.reduce((plugOrPromise,newValue,index) => {
                            if(newValue instanceof Plug || isPromise(newValue)){
                                plugOrPromise.push({index,value:newValue});
                            }
                            return plugOrPromise;
                        },[]);

                        if(plugOrPromiseValue.length>0){
                            node.ownerElement.id = node.ownerElement.id || uuidv4();
                            let id = node.ownerElement.id;
                            context.addEventListener(Event.SYNCING_DONE,()=>{
                                let node = document.getElementById(id);
                                if (!node) {
                                    node = context.root.getElementsByTagName("*")[id];
                                }
                                plugOrPromiseValue.forEach(({index,value}) => {
                                    let valueIndex = index;
                                    let attributeNode = node.getAttributeNode(nodeName);

                                    let setContent = (value) => {
                                        let marker = Marker.from(node);
                                        let {nodeValue:template,valueIndexes,newValues:templateValue} = marker.attributes[nodeName];
                                        newValues[valueIndex] = value;
                                        HtmlTemplate.updateAttributeValue(nodeValue, valueIndexes, newValues, attributeNode);
                                    };

                                    if(value instanceof Plug){
                                        value.factory.apply(null,[{
                                            node : attributeNode,
                                            name : nodeName,
                                            getContent : () => {
                                                let marker = Marker.from(node);
                                                let {newValues:templateValue} = marker.attributes[nodeName];
                                                return newValues[valueIndex];
                                            },
                                            setContent
                                        }]);
                                    }
                                    if(isPromise(value)){
                                        value.then(setContent);
                                    }
                                });
                            });
                        }else{
                            HtmlTemplate.updateAttributeValue(nodeValue, valueIndexes, newValues, node);
                        }
                        marker.attributes[nodeName] = {template : nodeValue,valueIndexes,templateValue : newValues};
                    }
                }
                if (node.nodeType === Node.TEXT_NODE) {
                    node.nodeValue = buildActualAttributeValue(nodeValueIndex.nodeValue, valueIndexes, newValues);
                }
                if (node.nodeType === Node.COMMENT_NODE) {
                    let value = newValues[valueIndexes];
                    Outlet.from(node).setContent(value,context);
                }
                nodeValueIndex.values = newActualValues;
            });
        }

        static updateAttributeValue(attributeValue, valueIndexes, newValues, attributeNode) {
            let nodeName = attributeNode.nodeName;
            let actualAttributeValue = buildActualAttributeValue(attributeValue, valueIndexes, newValues);
            if (isMinimizationAttribute(attributeNode)) {
                attributeNode.ownerElement[nodeName] = actualAttributeValue.trim() === "true";
                attributeNode.ownerElement.setAttribute(nodeName, "");
            } else {
                attributeNode.ownerElement.setAttribute(nodeName, actualAttributeValue);
                if (attributeChangesReflectToProperties(nodeName, attributeNode.ownerElement.nodeName)) {
                    attributeNode.ownerElement[nodeName] = actualAttributeValue;
                }
            }
            if (nodeName.indexOf(".bind") >= 0) {
                let attributeName = nodeName.substring(0, nodeName.indexOf(".bind"));
                attributeNode.ownerElement.setAttribute(attributeName, actualAttributeValue);
                attributeNode.ownerElement.removeAttribute(nodeName);
            }
            return actualAttributeValue;
        }

        buildTemplate(templateString) {
            this.documentFragment = HtmlTemplate.getProperTemplateTag(templateString);
            this.nodeValueIndexArray = this.buildNodeValueIndex(this.documentFragment, this.documentFragment.nodeName);
            HtmlTemplate.applyValues(this, this.nodeValueIndexArray);
        }

        buildNodeValueIndex(documentFragment, documentFragmentNodeName) {
            let childNodes = documentFragment.childNodes;
            let nodeValueIndexArray = [];
            let node = childNodes[0];
            if (undefined === node) {
                return nodeValueIndexArray;
            }
            do {
                if (node.nodeType === Node.ELEMENT_NODE) {
                    let attributes = node.attributes;
                    let k = attributes.length;
                    for (let attributeIndex = 0; attributeIndex < k; attributeIndex++) {
                        let nodeValue = attributes[attributeIndex].nodeValue;
                        let nodeValueIndexMap = HtmlTemplate.lookNodeValueArray(nodeValue);
                        let valueIndexes = nodeValueIndexMap.map(x => x.match(/[\w\.]+/)[0]).map(i => parseInt(i));
                        if (valueIndexes && valueIndexes.length > 0) {
                            nodeValueIndexArray.push({node: attributes[attributeIndex], valueIndexes, nodeValue});
                        }
                    }
                    nodeValueIndexArray = nodeValueIndexArray.concat(this.buildNodeValueIndex(node, node.nodeName));
                }
                if (node.nodeType === Node.TEXT_NODE && documentFragmentNodeName.toUpperCase() === "STYLE") {
                    let nodeValue = node.nodeValue;
                    let nodeValueIndexMap = HtmlTemplate.lookNodeValueArray(nodeValue);
                    let valueIndexes = nodeValueIndexMap.map(x => x.match(/[\w\.]+/)[0]).map(i => parseInt(i));
                    if (valueIndexes && valueIndexes.length > 0) {
                        nodeValueIndexArray.push({node, valueIndexes, nodeValue});
                    }
                }
                if (node.nodeType === Node.COMMENT_NODE) {
                    let nodeValue = node.nodeValue;
                    node.nodeValue = "outlet";
                    nodeValueIndexArray.push({node: node, valueIndexes: parseInt(nodeValue)});
                }
                node = node.nextSibling;
            } while (node);
            return nodeValueIndexArray;
        }

        constructTemplate() {
            if (!this.context.hasCache(this.key)) {
                let templateString = this.buildStringSequence();
                this.buildTemplate(templateString);
                return this.context.cache(this.key, this);
            }
            let htmlTemplate = this.context.cache(this.key);
            let promisesPlaceholder = htmlTemplate.documentFragment.querySelectorAll("span[data-async-outlet]");
            let promisesPlaceHolderLength = promisesPlaceholder.length;
            while(promisesPlaceHolderLength--){
                let promisePlaceholder = promisesPlaceholder[promisesPlaceHolderLength];
                if(promisePlaceholder.nextSibling){
                    let outlet = Outlet.from(promisePlaceholder.nextSibling);
                    outlet.clearContent();
                }
            }
            return htmlTemplate;
        }

        buildStringSequence() {
            return this.strings.reduce((result, string, index) => {
                return index === 0 ? string : `${result}<!--${(index - 1)}-->${string}`;
            }, "").trim();
        }
    }

    class Context {
        constructor() {
            this.cacheInstance = {};
            this.syncCallbackStack = [];
            this.html = (strings, ...values) => new HtmlTemplate(strings, values, this);
            this.htmlCollection = (arrayItems, keyFn, templateFn) => new HtmlTemplateCollection(arrayItems, keyFn, templateFn, this);
            this.listeners = {};
        }

        hasCache(key) {
            return key in this.cacheInstance;
        }

        cache(key, data) {
            if (!this.hasCache(key)) {
                this.cacheInstance[key] = data;
            }
            return this.cacheInstance[key];
        }

        addSyncCallback(callback) {
            this.syncCallbackStack.push(callback);
        }

        addEventListener(event,callback,calledOnce=false){
            let token = `${event}:${uuidv4()}`;
            this.listeners[event] = this.listeners[event] || [];
            let listener = this.listeners[event];
            listener.push({token,callback,calledOnce});
            return token;
        }

        removeEventListener(token){
            let [event,tokenId] = token.split(":");
            let listener = this.listeners[event];
            listener = listener.filter(callbackItem => callbackItem.token != tokenId);
            this.listeners[event] = listener;
        }

        dispatchEvent(event,...payload){
            if(!(event in this.listeners)){
                return;
            }
            let listener = this.listeners[event];

            let markForRemoval = [];
            listener.forEach(callbackItem => {
                callbackItem.callback.apply(null,payload);
                if(callbackItem.calledOnce){
                    let [event,tokenId] = callbackItem.token.split(":");
                    markForRemoval.push(tokenId);
                }
            });
            if(markForRemoval.length > 0){
                listener = listener.filter(callbackItem => {
                    return markForRemoval.indexOf(callbackItem.token) < 0
                });
            }
            this.listeners[event] = listener;
        }

        clearSyncCallbacks() {
            this.syncCallbackStack.forEach((callback) => callback.apply());
            this.syncCallbackStack = [];
            this.dispatchEvent(Event.SYNCING_DONE);
        }
    }

    const getTemporaryOutlet = (id, context) => {
        let templateContent = document.getElementById(id);
        if (!templateContent) {
            templateContent = context.root.getElementsByTagName("*")[id];
        }
        if(templateContent){
            let commentNode = templateContent.nextSibling;
            templateContent.remove();
            return Outlet.from(commentNode);
        }
        return false;
    };

    class Outlet {
        constructor(commentNode) {
            this.commentNode = commentNode;
            this.content = null;
        }

        static from(node) {
            if (node instanceof Comment) {
                node.$data = node.$data || new Outlet(node);
                return node.$data;
            } else {
                if (!node.$outlet) {
                    node.$outlet = document.createComment("outlet");
                    node.appendChild(node.$outlet);
                }
                return Outlet.from(node.$outlet);
            }
        }

        constructTextContent() {
            this.content = this.commentNode.previousSibling;
        }

        constructHtmlTemplateCollectionContent(htmlTemplateCollection) {
            this.content = new HtmlTemplateCollectionInstance(htmlTemplateCollection, this);
            this.content.instance = {};
            let pointer = this.commentNode;
            htmlTemplateCollection.iterateRight((item, key) => {
                do {
                    pointer = pointer.previousSibling;
                } while (pointer.nodeType !== Node.COMMENT_NODE && pointer.nodeValue !== "outlet-child");
                this.content.instance[key] = pointer;
            });
        }

        constructHtmlTemplateContent(htmlTemplate) {
            if(htmlTemplate === undefined){
                return;
            }
            let childNodesLength = htmlTemplate.context.cache(htmlTemplate.key).documentFragment.childNodes.length;
            this.content = new HtmlTemplateInstance(htmlTemplate, this);
            let sibling = this.commentNode;
            while (childNodesLength--) {
                sibling = sibling.previousSibling;
                this.content.instance.push(sibling);
            }
            this.content.instance.reverse();

        }

        makeTemporaryOutlet(context){
            let id = uuidv4();
            this.setHtmlTemplateContent(context.html`<span id="${id}" style="display: none" data-async-outlet>outlet</span>`);
            return id;
        };

        setContent(template,context) {
            if (isPromise(template)) {
                if (this.content === null) {
                    let id = this.makeTemporaryOutlet(context);
                    template.then((result) => {
                        let outlet = getTemporaryOutlet(id, context);
                        if(outlet){
                            outlet.setContent(result);
                            syncNode(result, outlet.commentNode);
                        }
                    });
                } else {
                    template.then((result) => {
                        this.setContent(result);
                    });
                }
            } else if (template instanceof Plug) {
                if (this.content === null) {
                    let id = this.makeTemporaryOutlet(context);
                    context.addEventListener(Event.SYNCING_DONE,() => {
                        let outlet = getTemporaryOutlet(id, context);
                        if(outlet){
                            template.factory.apply(null, [{
                                getContent : () => outlet.currentContent,
                                setContent : (value) =>{
                                    outlet.setContent.apply(outlet,[value]);
                                    outlet.currentContent = value;
                                }
                            }]);
                        }
                    },true);
                } else {
                    let self = this;
                    template.factory.apply(null, [{
                        getContent : () => self.currentContent,
                        setContent : (value) => {
                            self.setContent.apply(self,[value]);
                            self.currentContent = value;
                        }
                    }]);
                }
            } else if (template instanceof HtmlTemplate) {
                this.setHtmlTemplateContent(template);
            } else if (template instanceof HtmlTemplateCollection) {
                this.setHtmlTemplateCollectionContent(template);
            } else {
                this.setTextContent(template);
            }
        }

        setTextContent(text) {
            if (this.content instanceof Text) {
                this.content.nodeValue = text;
            } else {
                this.clearContent();
                this.content = document.createTextNode(text);
                this.commentNode.parentNode.insertBefore(this.content, this.commentNode);
            }
        }

        setHtmlTemplateCollectionContent(htmlTemplateCollection) {
            let clearContentWasCalled = false;
            if (this.content && !(this.content instanceof HtmlTemplateCollectionInstance)) {
                clearContentWasCalled = true;
                this.clearContent();
            }
            this.content = this.content || new HtmlTemplateCollectionInstance(htmlTemplateCollection, this);
            this.content.applyValues(htmlTemplateCollection);
            if (clearContentWasCalled) {
                syncNode(htmlTemplateCollection, this.commentNode);
            }
        }

        setHtmlTemplateContent(htmlTemplate) {
            let clearContentWasCalled = false;
            let contentHasSameKey = this.content && this.content instanceof HtmlTemplateInstance ? this.content.template.key === htmlTemplate.key : false;
            if (this.content !== null && !contentHasSameKey) {
                this.clearContent();
                clearContentWasCalled = true;
            }
            if (!this.content) {
                let template = htmlTemplate.constructTemplate();
                this.content = new HtmlTemplateInstance(template, this);
            }
            this.content.applyValues(htmlTemplate);
            if (clearContentWasCalled) {
                syncNode(htmlTemplate, this.commentNode);
            }
        }

        clearContent() {
            if (this.content !== null) {
                if (this.content instanceof Template) {
                    this.content.destroy();
                } else {
                    this.content.remove();
                }
                this.content = null;
            }
        }

        firstChildNode() {
            if (this.content instanceof HtmlTemplateInstance) {
                return this.content.instance[0];
            } else if (this.content instanceof HtmlTemplateCollectionInstance) {
                let firstKey = this.content.template.keys[0];
                let outlet = Outlet.from(this.content.instance[firstKey]);
                return outlet.firstChildNode();
            } else {
                return this.content;
            }
        }

        validateInstancePosition() {
            if (this.content instanceof HtmlTemplateInstance) {
                this.content.instance.reduceRight((pointer, ctn) => {
                    if (pointer.previousSibling !== ctn) {
                        pointer.parentNode.insertBefore(ctn, pointer);
                    }
                    return ctn;
                }, this.commentNode);
            } else if (this.content instanceof HtmlTemplateCollectionInstance) {
                // not required since we already sync when rendering
            } else {
                if (this.commentNode.previousSibling !== this.content) {
                    this.commentNode.parentNode.insertBefore(this.content, this.commentNode);
                }
            }
        }
    }

    class HtmlTemplateCollectionInstance extends Template {
        constructor(templateCollection, outlet) {
            super();
            this.template = templateCollection;
            this.outlet = outlet;
            this.instance = null;
        }

        applyValues(newHtmlTemplateCollection) {
            let context = newHtmlTemplateCollection.context;
            if (this.instance === null) {
                this.instance = {};
                let outletPointer = this.outlet.commentNode;
                newHtmlTemplateCollection.iterateRight((item, key, template) => {
                    let childPlaceholder = Outlet.from(document.createComment("outlet-child"));
                    outletPointer.parentNode.insertBefore(childPlaceholder.commentNode, outletPointer);
                    Outlet.from(childPlaceholder.commentNode).setContent(template,context);
                    outletPointer = childPlaceholder.firstChildNode();
                    this.instance[key] = childPlaceholder.commentNode;
                });
            } else {
                newHtmlTemplateCollection.iterateRight();
                if (newHtmlTemplateCollection.items.length === 0) {
                    if (this.outlet.commentNode.parentNode.$htmlCollectionInstanceChild && this.outlet.commentNode.parentNode.$htmlCollectionInstanceChild.length === 1) {
                        let parentNode = this.outlet.commentNode.parentNode;
                        parentNode.innerText = "";
                        parentNode.appendChild(this.outlet.commentNode);
                        this.instance = {};
                    }
                } else {
                    let oldHtmlTemplateCollection = this.template;
                    oldHtmlTemplateCollection.keys.forEach((key) => {
                        let keyIsDeleted = newHtmlTemplateCollection.keys.indexOf(key) < 0;
                        if (keyIsDeleted) {
                            let commentNode = this.instance[key];
                            Outlet.from(commentNode).clearContent();
                            commentNode.remove();
                            delete this.instance[key];
                        }
                    });
                }
                let outletPointer = this.outlet.commentNode;
                newHtmlTemplateCollection.iterateRight((item, key, template) => {
                    let commentNode = this.instance[key];
                    if (commentNode) {
                        let childOutlet = Outlet.from(commentNode);
                        childOutlet.setContent(template);
                        if (outletPointer.previousSibling !== commentNode) {
                            outletPointer.parentNode.insertBefore(commentNode, outletPointer);
                            childOutlet.validateInstancePosition();
                        }
                        outletPointer = childOutlet.firstChildNode();
                    } else {
                        let childPlaceholder = Outlet.from(document.createComment("outlet-child"));
                        outletPointer.parentNode.insertBefore(childPlaceholder.commentNode, outletPointer);
                        Outlet.from(childPlaceholder.commentNode).setContent(template,context);
                        outletPointer = childPlaceholder.firstChildNode();
                        this.instance[key] = childPlaceholder.commentNode;
                        this.template.context.addSyncCallback(() => syncNode(template, childPlaceholder.commentNode));
                    }
                });
                this.template = newHtmlTemplateCollection;
            }
        }

        destroy() {
            this.template.keys.forEach((key) => {
                let childPlaceholderCommentNode = this.instance[key];
                Outlet.from(childPlaceholderCommentNode).clearContent();
                childPlaceholderCommentNode.remove();
                delete this.instance[key];
            });

            this.outlet = null;
            this.instance = null;
            this.template = null;
        }
    }

    class HtmlTemplateInstance extends Template {
        constructor(template, outlet) {
            super();
            this.template = template;
            this.outlet = outlet;
            this.instance = [];
            this.nodeValueIndexArray = null;
        }

        applyValues(newHtmlTemplate) {
            if (this.instance === null || this.instance.length === 0) {
                HtmlTemplate.applyValues(newHtmlTemplate, this.template.nodeValueIndexArray);
                let documentFragment = this.template.documentFragment;
                let cloneNode = cloneNodeTree(documentFragment);
                let commentNode = this.outlet.commentNode;
                let cloneChildNode = cloneNode.childNodes[0];
                let nextSibling = null;
                do {
                    this.instance.push(cloneChildNode);
                    nextSibling = cloneChildNode.nextSibling;
                    commentNode.parentNode.insertBefore(cloneChildNode, commentNode);
                    cloneChildNode = nextSibling;
                } while (cloneChildNode);
            } else if (this.nodeValueIndexArray) {
                HtmlTemplate.applyValues(newHtmlTemplate, this.nodeValueIndexArray);
            }
        }

        destroy() {
            this.instance.forEach((instance) => instance.remove());
            this.nodeValueIndexArray = null;
            this.outlet = null;
            this.template = null;
        }
    }

    const applyAttributeValue = (actualNode, valueIndexes, templateValues, nodeValue) => {
        let marker = Marker.from(actualNode);
        let nodeName = actualNode.nodeName;
        let isEvent = nodeName.indexOf("on") === 0;
        if (isEvent) {
            let valueIndex = valueIndexes[0];
            marker.attributes[nodeName] = templateValues[valueIndex];
            actualNode.ownerElement.setAttribute(nodeName, "return false;");
            actualNode.ownerElement[nodeName] = templateValues[valueIndex];
        } else {
            marker.attributes[nodeName] = {
                template : nodeValue,
                valueIndexes,
                templateValue : templateValues
            };
        }
    };

    const applyOutletValue = (actualNode, templateValues, valueIndexes) => {
        let outlet = Outlet.from(actualNode);
        let value = templateValues[valueIndexes];
        if (value instanceof HtmlTemplate) {
            outlet.constructHtmlTemplateContent(value);
            syncNode(value, outlet.commentNode);
        }
        else if (value instanceof HtmlTemplateCollection) {
            outlet.constructHtmlTemplateCollectionContent(value);
            syncNode(value, outlet.commentNode);
        }
        else {
            outlet.constructTextContent();
        }
    };

    const mapNodeValueIndexArray = (nodeValueIndex, docFragment, templateValues = []) => {
        let {nodeValue, valueIndexes} = nodeValueIndex;
        let path = getPath(nodeValueIndex.node);
        let actualNode = getNode(path, docFragment);
        let values = Array.isArray(valueIndexes) ? valueIndexes.map(index => templateValues[index]) : templateValues[valueIndexes];
        let isStyleNode = actualNode.parentNode && actualNode.parentNode.nodeName.toUpperCase() === "STYLE";
        if (isStyleNode) {
            return {node: actualNode, valueIndexes, nodeValue, values};
        } else if (actualNode.nodeType === Node.ATTRIBUTE_NODE) {
            applyAttributeValue(actualNode, valueIndexes, templateValues, nodeValue);
            return {node: actualNode, valueIndexes, nodeValue, values};
        } else {
            applyOutletValue(actualNode, templateValues, valueIndexes);
            return {node: actualNode, valueIndexes, values};
        }
    };

    const syncNode = (nextTemplate, node) => {
        let outlet = Outlet.from(node);
        if (outlet.content && outlet.content instanceof HtmlTemplateInstance) {
            let htmlTemplateInstance = outlet.content;
            let originalTemplate = htmlTemplateInstance.template;
            let templateValues = nextTemplate.values;
            let docFragment = {childNodes: htmlTemplateInstance.instance};
            if (originalTemplate.nodeValueIndexArray === null) {
                let cacheTemplate = originalTemplate.context.cache(originalTemplate.key);
                docFragment = {childNodes: outlet.content.instance};
                htmlTemplateInstance.nodeValueIndexArray = cacheTemplate.nodeValueIndexArray.map(nodeValueIndex => mapNodeValueIndexArray(nodeValueIndex, docFragment, templateValues));
            } else {
                htmlTemplateInstance.nodeValueIndexArray = originalTemplate.nodeValueIndexArray.map(nodeValueIndex => mapNodeValueIndexArray(nodeValueIndex, docFragment, templateValues));
            }
        }
        if (outlet.content && outlet.content instanceof HtmlTemplateCollectionInstance) {
            let htmlTemplateCollectionInstance = outlet.content;
            let templates = htmlTemplateCollectionInstance.template.templates;
            let keys = htmlTemplateCollectionInstance.template.keys;
            outlet.commentNode.parentNode.$htmlCollectionInstanceChild = outlet.commentNode.parentNode.$htmlCollectionInstanceChild || [];
            outlet.commentNode.parentNode.$htmlCollectionInstanceChild.push(outlet.commentNode);
            keys.forEach(key => {
                let template = templates[key];
                let commentNode = htmlTemplateCollectionInstance.instance[key];
                let outlet = Outlet.from(commentNode);
                if (outlet.content === null) {
                    if (template instanceof HtmlTemplate) {
                        outlet.constructHtmlTemplateContent(template.context.cache(template.key));
                        syncNode(template, commentNode);
                    }
                } else {
                    if (outlet.content instanceof HtmlTemplateInstance) {
                        syncNode(template, commentNode);
                    }
                }
            });
        }
    };

    const syncContent = function (templateValue,node) {
        if (!node.$synced) {
            syncNode(templateValue, node);
            node.$synced = true;
        }
    };
    const setContent = (templateValue,node) => {
        templateValue.context.root = templateValue.context.root || node;
        Outlet.from(node).setContent(templateValue);
    };

    const executeWithIdleCallback = (callback) => {
        if ("requestIdleCallback" in window) {
            requestIdleCallback(callback);
        } else {
            callback();
        }
    };
    const executeWithRequestAnimationFrame = (callback) => {
        if ("requestAnimationFrame" in window) {
            requestAnimationFrame(callback);
        } else {
            callback();
        }
    };

    const render = (templateValue, node , immediateEffect = true) => {
        if("Promise" in window){
            return new Promise(resolve => {
                let update = ()=>{
                    setContent.apply(null,[templateValue,node]);
                    resolve();
                };
                if(immediateEffect){
                    executeWithRequestAnimationFrame(update);
                }else{
                    executeWithIdleCallback(update);
                }

            }).then(()=>{
                return new Promise(resolve => {
                    executeWithIdleCallback(()=>{
                        syncContent.apply(null,[templateValue,node]);
                        resolve();
                    });
                });
            }).then(() => {
                return new Promise(resolve => {
                    executeWithIdleCallback(() =>{
                        templateValue.context.clearSyncCallbacks();
                        resolve();
                    });
                });
            });
        }else{
            let thencallback = {then:()=>{}};
            setTimeout(()=>{
                setContent(templateValue,node);
                syncContent(templateValue,node);
                templateValue.context.clearSyncCallbacks();
                thencallback.then.apply(null,[]);
            },0);
            return thencallback;

        }
    };

    class Plug {
        constructor(factory) {
            this.factory = factory;
        }
    }

    const plug = (callback) => {
        return new Plug(callback);
    };

    return {Context, render, plug, uuidv4, Event};
}));