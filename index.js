var ReactDOM = require("react-dom");

module.exports = {
	render: function (reactElement, domElement, hash, callback) {
		if (!domElement) throw new Error("domElement is a required argument to render(). You passed in " + domElement);
		if (!domElement.childNodes) throw new Error("domElement must have a childNodes attribute. Did you pass in something other than a DOM node?");
		if (domElement.childNodes.length !== 1) throw new Error("domElement must have one and only one child. Did you add some extra nodes in the server rendering process?");
		if (!domElement.setAttribute) throw new Error("domElement must have a setAttribute() method. Did you pass in something other than a DOM element?");
		if (typeof hash === "undefined") throw new Error("hash is a required argument to render().");

		var renderRoot = domElement.childNodes[0];
		renderRoot.setAttribute("data-react-checksum", hash);
		return ReactDOM.render(reactElement, domElement, callback);
	}
}