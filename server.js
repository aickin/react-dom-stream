var ReactDOMStream = require("./lib/ReactDOMServer");

module.exports = {
	renderToString: ReactDOMStream.renderToStringStream,
	renderToStaticMarkup: ReactDOMStream.renderToStaticMarkupStream
};