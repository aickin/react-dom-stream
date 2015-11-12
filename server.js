// when in production mode, use the minified version; it's much, much faster.
var ReactDOMStream;
if (process.env.NODE_ENV === "production") {
	ReactDOMStream = require("./dist/react.min");
	module.exports = {
		renderToString: ReactDOMStream.renderToString,
		renderToStaticMarkup: ReactDOMStream.renderToStaticMarkup
	};

} else {
	ReactDOMStream = require("./lib/ReactDOMServer");

	module.exports = {
		renderToString: ReactDOMStream.renderToStringStream,
		renderToStaticMarkup: ReactDOMStream.renderToStaticMarkupStream
	};
}
