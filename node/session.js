/*** modules ***/
	const CORE = require("../node/core")
	module.exports = {}

/*** creates ***/
	/* createOne */
		module.exports.createOne = createOne
		function createOne(REQUEST, RESPONSE, callback) {
			try {
				// session
					const session = CORE.getSchema("session")
						session.info.ip = REQUEST.ip
						session.info["user-agent"] = REQUEST.headers["user-agent"]
						session.info.language = REQUEST.headers["accept-language"]

				// query
					const query = CORE.getSchema("query")
						query.collection = "sessions"
						query.command = "insert"
						query.document = session

				// insert
					CORE.accessDatabase(query, results => {
						if (!results.success) {
							CORE.logError(results.message)
							return
						}

						REQUEST.session = session
						REQUEST.cookie.session = session.id
						callback(REQUEST, RESPONSE)
						return
					})
			}
			catch (error) {
				CORE.logError(error)
				callback({success: false, message: `unable to ${arguments.callee.name}`})
			}
		}

/*** reads ***/
	/* readOne */
		module.exports.readOne = readOne
		function readOne(REQUEST, RESPONSE, callback) {
			try {
				// asset / ping
					if (REQUEST.fileType || (/^\/ping\/?$/).test(REQUEST.url)) {
						callback(REQUEST, RESPONSE)
						return
					}

				// no cookie --> new session
					if (!REQUEST.cookie.session) {
						createOne(REQUEST, RESPONSE, callback)
						return
					}

				// query
					const query = CORE.getSchema("query")
						query.collection = "sessions"
						query.command = "find"
						query.filters = {id: REQUEST.cookie.session}

				// find
					CORE.accessDatabase(query, results => {
						if (!results.success) {
							REQUEST.session = REQUEST.cookie.session = null
							readOne(REQUEST, RESPONSE, callback)
							return
						}

						// update
							REQUEST.session = results.documents[0]
							updateOne(REQUEST, RESPONSE, callback)
							return
					})
			}
			catch (error) {
				CORE.logError(error)
				callback({success: false, message: `unable to ${arguments.callee.name}`})
			}
		}

/*** updates ***/
	/* updateOne */
		module.exports.updateOne = updateOne
		function updateOne(REQUEST, RESPONSE, callback) {
			try {
				// query
					const query = CORE.getSchema("query")
						query.collection = "sessions"
						query.command = "update"
						query.filters = {id: REQUEST.session.id}
						query.document = {
							updated: new Date().getTime()
						}

					if (REQUEST.updateSession && REQUEST.updateSession.userId !== undefined) {
						query.document.userId = REQUEST.updateSession.userId
					}
					if (REQUEST.updateSession && REQUEST.updateSession.gameId !== undefined) {
						query.document.gameId = REQUEST.updateSession.gameId
					}

				// update
					CORE.accessDatabase(query, results => {
						if (!results.success) {
							REQUEST.session = REQUEST.cookie.session = null
							readOne(REQUEST, RESPONSE, callback)
							return
						}

						// results
							REQUEST.session = results.documents[0]
							REQUEST.cookie.session = results.documents[0].id
							callback(REQUEST, RESPONSE)
					})
			}
			catch (error) {
				CORE.logError(error)
				callback({success: false, message: `unable to ${arguments.callee.name}`})
			}
		}
