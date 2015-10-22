To do:

* Change the API to return a Stream with a hash Promise property. (issue #2)
** Test whether streams need to be written to asynchronously to avoid buffering.
* Support streams and Promises as first-class citizens in `renderToStaticMarkup`. (idea in issue #2)
* Determine best practices for using `compression`.
** Test gzip compression with the ZLIB streaming argument. (issue #5)
** Test yielding to the event loop as a way to get compression to stream out.
** Figure out how to rationalize `bufferSize` and `compression`.
* Write some more tests
** rendering functional components
** writing out script tags with `renderToStaticMarkup`
 