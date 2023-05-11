/*** modules ***/
	const HTTP    = require("http")
	const FS      = require("fs")
	const QS      = require("querystring")
	const WS      = require("websocket").server

	const CORE    = require("./node/core")
	const GAME    = require("./node/game")
	const USER    = require("./node/user")
	const SESSION = require("./node/session")

/*** constants ***/
	const ENVIRONMENT = CORE.getEnvironment()
	const CONSTANTS = CORE.getAsset("constants")

/*** server ***/
	/* server */
		const SERVER = HTTP.createServer(handleRequest)
			SERVER.listen(ENVIRONMENT.port, launchServer)

	/* launchServer */
		function launchServer(error) {
			if (error) {
				CORE.logError(error)
				return
			}
			CORE.logStatus(`listening on port ${ENVIRONMENT.port}`)
		}

	/* handleRequest */
		function handleRequest(REQUEST, RESPONSE) {
			try {
				// collect data
					let data = ""
					REQUEST.on("data", chunk => {
						data += chunk
					})
					REQUEST.on("end", () => {
						parseRequest(REQUEST, RESPONSE, data)
					})
			}
			catch (error) {CORE.logError(error)}
		}

	/* parseRequest */
		function parseRequest(REQUEST, RESPONSE, data) {
			try {
				// get info
					REQUEST.get         = QS.parse(REQUEST.url.split("?")[1]) || {}
					REQUEST.path        = REQUEST.url.split("?")[0].split("/") || []
					REQUEST.url         = REQUEST.url.split("?")[0] || "/"
					REQUEST.post        = data ? JSON.parse(data) : {}
					REQUEST.cookie      = REQUEST.headers.cookie ? QS.parse(REQUEST.headers.cookie.replace(/;\s/g, "&")) : {}
					REQUEST.ip          = REQUEST.headers["x-forwarded-for"] || REQUEST.connection.remoteAddress || REQUEST.socket.remoteAddress || REQUEST.connection.socket.remoteAddress
					REQUEST.contentType = CORE.getContentType(REQUEST.url)
					REQUEST.fileType    = (/[.]([a-zA-Z0-9])+$/).test(REQUEST.url) ? (REQUEST.path[REQUEST.path.length - 1].split(".")[1] || null) : null

				// log it
					if (REQUEST.url !== "/favicon.ico") {
						CORE.logStatus(`${REQUEST.cookie.session || "new"} @ ${REQUEST.ip}\n` + 
							`[${REQUEST.method}] ${REQUEST.path.join("/")}\n` + 
							(   REQUEST.method == "GET" ? JSON.stringify(REQUEST.get) : 
							`{${REQUEST.post.action}: [${Object.keys(REQUEST.post).filter(key => key !== "action").map(key => `"${key}"`).join(", ")}]}`))
					}

				// readSession
					SESSION.readOne(REQUEST, RESPONSE, routeRequest)
			}
			catch (error) {_403(REQUEST, RESPONSE, `unable to ${arguments.callee.name}`)}
		}

	/* routeRequest */
		function routeRequest(REQUEST, RESPONSE) {
			try {
				// get
					if (REQUEST.method == "GET") {
						switch (true) {
							// ping
								case (/^\/ping\/?$/).test(REQUEST.url):
									try {
										RESPONSE.writeHead(200, {"Content-Type": `application/json`})
										RESPONSE.end(JSON.stringify({success: true, timestamp: new Date().getTime()})©)
									}
									catch (error) {_403(error)}
								break
								
							// favicon
								case (/\/favicon[.]ico$/).test(REQUEST.url):
								case (/\/icon[.]png$/).test(REQUEST.url):
								case (/\/apple\-touch\-icon[.]png$/).test(REQUEST.url):
								case (/\/apple\-touch\-icon\-precomposed[.]png$/).test(REQUEST.url):
								case (/\/logo[.]png$/).test(REQUEST.url):
									try {
										RESPONSE.writeHead(200, CORE.constructHeaders(REQUEST))
										FS.readFile("./assets/logo.png", (error, file) => {
											if (error) {
												_404(REQUEST, RESPONSE, error)
												return
											}
											RESPONSE.end(file, "binary")
										})
									}
									catch (error) {_404(REQUEST, RESPONSE, error)}
								break

							// css
								case (REQUEST.fileType == "css"):
									try {
										RESPONSE.writeHead(200, CORE.constructHeaders(REQUEST))
										FS.readFile("./css/" + REQUEST.path[REQUEST.path.length - 1], (error, file) => {
											if (error) {
												_404(REQUEST, RESPONSE, error)
												return
											}
											RESPONSE.end(file, "binary")
										})
									}
									catch (error) {_404(REQUEST, RESPONSE, error)}
								break

							// js
								case (REQUEST.fileType == "js"):
									try {
										RESPONSE.writeHead(200, CORE.constructHeaders(REQUEST))
										FS.readFile("./js/" + REQUEST.path[REQUEST.path.length - 1], (error, file) => {
											if (error) {
												_404(REQUEST, RESPONSE, error)
												return
											}
											RESPONSE.end(file, "binary")
										})
									}
									catch (error) {_404(REQUEST, RESPONSE, error)}
								break

							// asset
								case (/[.]([a-zA-Z0-9])+$/).test(REQUEST.url):
									try {
										RESPONSE.writeHead(200, CORE.constructHeaders(REQUEST))
										FS.readFile("./assets/" + REQUEST.path[REQUEST.path.length - 1], (error, file) => {
											if (error) {
												_404(REQUEST, RESPONSE, error)
												return
											}
											RESPONSE.end(file, "binary")
										})
									}
									catch (error) {_404(REQUEST, RESPONSE, error)}
								break

							// home
								case (/^\/?$/).test(REQUEST.url):
									try {
										RESPONSE.writeHead(200, CORE.constructHeaders(REQUEST))
										CORE.renderHTML(REQUEST, "./html/home.html", html => {
											RESPONSE.end(html)
										})
									}
									catch (error) {_404(REQUEST, RESPONSE, error)}
								break

							// game
								case (CONSTANTS.gamePathRegex).test(REQUEST.url):
									try {
										// find game
											const gameId = REQUEST.path[REQUEST.path.length - 1]
											if (REQUEST.session.userId && REQUEST.session.gameId && REQUEST.session.gameId == gameId) {
												REQUEST.post = {gameId: gameId}
												GAME.readOne(REQUEST, data => {
													if (!data.success) {
														_404(REQUEST, RESPONSE, `game ${gameId} not found`)
													}

													REQUEST.game = data.game
													RESPONSE.writeHead(200, CORE.constructHeaders(REQUEST))
													CORE.renderHTML(REQUEST, "./html/game.html", html => {
														RESPONSE.end(html)
													})
												})
												return
											}

										// not in game
											_302(REQUEST, RESPONSE, `/`)
									}
									catch (error) {_404(REQUEST, RESPONSE, error)}
								break

							// user
								case (CONSTANTS.userPathRegex).test(REQUEST.url):
									try {
										// find user
											const userId = REQUEST.path[REQUEST.path.length - 1]
											REQUEST.post = {userId: userId}
											USER.readOne(REQUEST, data => {
												if (!data.success) {
													_404(REQUEST, RESPONSE, `user ${userId} not found`)
												}

												REQUEST.user = data.user
												RESPONSE.writeHead(200, CORE.constructHeaders(REQUEST))
												CORE.renderHTML(REQUEST, "./html/user.html", html => {
													RESPONSE.end(html)
												})
											})
									}
									catch (error) {_404(REQUEST, RESPONSE, error)}
								break

							// data
								case (/^\/data$/).test(REQUEST.url):
									try {
										if (!ENVIRONMENT.debug) {
											_404(REQUEST, RESPONSE)
											return
										}
										CORE.accessDatabase(null, data => {
											REQUEST.method = "POST"
											RESPONSE.writeHead(200, CORE.constructHeaders(REQUEST))
											RESPONSE.end(JSON.stringify(data, null, 2))
										})
									}
									catch (error) {_404(REQUEST, RESPONSE, error)}
								break

							// other
								default:
									_404(REQUEST, RESPONSE, REQUEST.url)
									return
								break
						}
					}

				// post
					else if (REQUEST.method == "POST" && REQUEST.post.action) {
						switch (REQUEST.post.action) {
							// home
								// createUser
									case "createUser":
										try {
											RESPONSE.writeHead(200, CORE.constructHeaders(REQUEST))
											USER.createOne(REQUEST, data => {
												RESPONSE.end(JSON.stringify(data))
											})
										}
										catch (error) {_403(REQUEST, RESPONSE, error)}
									break

								// logInUser
									case "logInUser":
										try {
											RESPONSE.writeHead(200, CORE.constructHeaders(REQUEST))
											USER.logIn(REQUEST, data => {
												RESPONSE.end(JSON.stringify(data))
											})
										}
										catch (error) {_403(REQUEST, RESPONSE, error)}
									break

							// user
								// logOutUser
									case "logOutUser":
										try {
											RESPONSE.writeHead(200, CORE.constructHeaders(REQUEST))
											USER.logOut(REQUEST, data => {
												RESPONSE.end(JSON.stringify(data))
											})
										}
										catch (error) {_403(REQUEST, RESPONSE, error)}
									break

								// updateUser
									case "updateUser":
										try {
											RESPONSE.writeHead(200, CORE.constructHeaders(REQUEST))
											USER.updateOne(REQUEST, data => {
												RESPONSE.end(JSON.stringify(data))
											})
										}
										catch (error) {_403(REQUEST, RESPONSE, error)}
									break

								// createGame
									case "createGame":
										try {
											RESPONSE.writeHead(200, CORE.constructHeaders(REQUEST))
											GAME.createOne(REQUEST, data => {
												RESPONSE.end(JSON.stringify(data))
											})
										}
										catch (error) {_403(REQUEST, RESPONSE, error)}
									break

								// joinGame
									case "joinGame":
										try {
											RESPONSE.writeHead(200, CORE.constructHeaders(REQUEST))
											GAME.joinOne(REQUEST, data => {
												RESPONSE.end(JSON.stringify(data))
											})
										}
										catch (error) {_403(REQUEST, RESPONSE, error)}
									break

							// others
								default:
									_403(REQUEST, RESPONSE)
								break
						}
					}

				// others
					else {_403(REQUEST, RESPONSE, "unknown route")}
			}
			catch (error) {_403(REQUEST, RESPONSE, `unable to ${arguments.callee.name}`)}
		}

	/* _302 */
		function _302(REQUEST, RESPONSE, data) {
			CORE.logStatus(`redirecting to ${(data || "/")}`)
			RESPONSE.writeHead(302, {Location: data || "../../../../"})
			RESPONSE.end()
		}

	/* _403 */
		function _403(REQUEST, RESPONSE, data) {
			CORE.logError(data)
			RESPONSE.writeHead(403, {"Content-Type": `application/json`})
			RESPONSE.end(JSON.stringify({success: false, error: data}))
		}

	/* _404 */
		function _404(REQUEST, RESPONSE, data) {
			CORE.logError(data)
			RESPONSE.writeHead(404, {"Content-Type": `text/html; charset=utf-8`})
			CORE.renderHTML(REQUEST, "./html/_404.html", html => {
				RESPONSE.end(html)
			})
		}

/*** socket ***/
	/* socket */
		ENVIRONMENT.ws_config.httpServer = SERVER
		const SOCKET = new WS(ENVIRONMENT.ws_config)
			SOCKET.on("request", handleSocket)
		const CONNECTIONS = {}

	/* handleSocket */
		function handleSocket(REQUEST) {
			try {
				// reject
					if ((REQUEST.origin.replace(/^https?\:\/\//g, "") !== ENVIRONMENT.domain)
					 && (REQUEST.origin !== `http://${ENVIRONMENT.domain}:${ENVIRONMENT.port}`)) {
						CORE.logStatus(`[REJECTED]: ${REQUEST.origin} @ " ${REQUEST.socket._peername.address || "?"}`)
						REQUEST.reject()
						return
					}

				// create connection
					if (!REQUEST.connection) {
						REQUEST.connection = REQUEST.accept(null, REQUEST.origin)
					}

				// parse connection
					parseSocket(REQUEST)
			}
			catch (error) {CORE.logError(error)}
		}

	/* parseSocket */
		function parseSocket(REQUEST) {
			try {
				// get request info
					REQUEST.url     = (REQUEST.httpRequest.headers.host || "") + (REQUEST.httpRequest.url || "")
					REQUEST.path    = REQUEST.httpRequest.url.split("?")[0].split("/") || []
					REQUEST.cookie  = REQUEST.httpRequest.headers.cookie ? QS.parse(REQUEST.httpRequest.headers.cookie.replace(/;\s/g, "&")) : {}
					REQUEST.headers = {}
					REQUEST.headers["user-agent"] = REQUEST.httpRequest.headers["user-agent"]
					REQUEST.headers["accept-language"] = REQUEST.httpRequest.headers["accept-langauge"]
					REQUEST.ip      = REQUEST.connection.remoteAddress || REQUEST.socket._peername.address

				// log it
					CORE.logStatus(`${REQUEST.cookie.session || "new"} @ ${REQUEST.ip}\n` +
						`[WEBSOCKET] ${REQUEST.path.join("/")}`)

				// get session and wait for messages
					SESSION.readOne(REQUEST, null, saveSocket)
			}
			catch (error) {_400(REQUEST, `unable to ${arguments.callee.name}`)}
		}

	/* saveSocket */
		function saveSocket(REQUEST) {
			try {
				// on connect - save connection & fetch music
					if (!CONNECTIONS[REQUEST.session.id]) {
						CONNECTIONS[REQUEST.session.id] = {}
					}
					CONNECTIONS[REQUEST.session.id][REQUEST.path[REQUEST.path.length - 1]] = REQUEST.connection
					sendSocketData({userId: REQUEST.session.userId, gameId: REQUEST.path[REQUEST.path.length - 1], success: true, message: `connected`, recipients: [REQUEST.session.id]})
					GAME.readOne(REQUEST, sendSocketData)

				// on close
					REQUEST.connection.on("close", (reasonCode, description) => {
						// remove from connections pool
							if (CONNECTIONS[REQUEST.session.id]) {
								delete CONNECTIONS[REQUEST.session.id][REQUEST.path[REQUEST.path.length - 1]]
							}
							if (!Object.keys(CONNECTIONS[REQUEST.session.id]).length) {
								delete CONNECTIONS[REQUEST.session.id]
							}

						// update game
							REQUEST.post = {action: "disconnectUser"}
							GAME.updateOne(REQUEST, sendSocketData)
					})

				// on message
					REQUEST.connection.on("message", message => {
						try {
							// get post data
								const data = JSON.parse(message.utf8Data)

							// invalid data?
								if (!data || typeof data !== "object") {
									return
								}

							// route
								REQUEST.post = data
								routeSocket(REQUEST)
						}
						catch (error) {CORE.logError(error)}
					})
			}
			catch (error) {_400(REQUEST, `unable to ${arguments.callee.name}`)}
		}

	/* routeSocket */
		function routeSocket(REQUEST) {
			try {
				// to game
					GAME.updateOne(REQUEST, sendSocketData)
			}
			catch (error) {_400(REQUEST, `unable to ${arguments.callee.name}`)}
		}

	/* sendSocketData */
		function sendSocketData(data) {
			try {
				// nothing to send or no one to send to
					if (!data.recipients || !data.gameId) {
						return
					}

				// get recipients
					const recipients = data.recipients.slice() || []
					delete data.recipients

				// stringify
					const gameId = data.gameId
					const stringifiedData = JSON.stringify(data)

				// loop through recipients
					for (const recipient of recipients) {
						try {
							if (CONNECTIONS[recipient] && CONNECTIONS[recipient][gameId]) {
								CONNECTIONS[recipient][gameId].sendUTF(stringifiedData)
							}
						}
						catch (error) {CORE.logError(error)}
					}
			}
			catch (error) {CORE.logError(error)}
		}

	/* _400 */
		function _400(REQUEST, data) {
			CORE.logError(data)
			REQUEST.connection.sendUTF(JSON.stringify({success: false, message: (data || "unknown websocket error")}))
		}
