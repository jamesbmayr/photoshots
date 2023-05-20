/*** modules ***/
	const FS   		= require("fs")
	const CRYPTO = require("crypto")
	module.exports = {}

/*** environment ***/
	const ENVIRONMENT = getEnvironment()
	const MONGO = ENVIRONMENT.db_url ? require("mongodb").MongoClient : null

/*** logs ***/
	/* logError */
		module.exports.logError = logError
		function logError(error) {
			if (ENVIRONMENT.debug) {
				console.log(`\n*** ERROR @ ${new Date().toLocaleString()} ***`)
				console.log(` - ${error}`)
				console.dir(arguments)
			}
		}

	/* logStatus */
		module.exports.logStatus = logStatus
		function logStatus(status) {
			if (ENVIRONMENT.debug) {
				console.log(`\n--- STATUS @ ${new Date().toLocaleString()} ---`)
				console.log(` - ${status}`)
			}
		}

	/* logMessage */
		module.exports.logMessage = logMessage
		function logMessage(message) {
			if (ENVIRONMENT.debug) {
				console.log(` - ${new Date().toLocaleString()}: ${message}`)
			}
		}

	/* logTime */
		module.exports.logTime = logTime
		function logTime(flag, callback) {
			if (ENVIRONMENT.debug) {
				const before = process.hrtime()
				callback()

				const after = process.hrtime(before)[1] / 1e6
				if (after > 10) {
					logMessage(`${flag} ${after}`)
				}
				else {
					logMessage(`.`)
				}
			}
			else {
				callback()
			}
		}

/*** maps ***/
	/* getEnvironment */
		module.exports.getEnvironment = getEnvironment
		function getEnvironment() {
			try {
				if (process.env.DOMAIN !== undefined) {
					return {
						port:            process.env.PORT,
						domain:          process.env.DOMAIN,
						debug:           process.env.DEBUG || false,
						cache:           process.env.CACHE || false,
						db_username:     process.env.DB_USERNAME,
						db_password:     process.env.DB_PASSWORD,
						db_url:          process.env.DB_URL,
						db_name:         process.env.DB_NAME,
						db:              `mongodb+srv://${process.env.DB_USERNAME}:${process.env.DB_PASSWORD}@${process.env.DB_URL}`,
						db_cache: {
							sessions:    {},
							users:     {},
							games:       {}
						},
						ws_config: {
							autoAcceptConnections: false
						}
					}
				}
				else {
					return {
						port:            3000,
						domain:          "localhost",
						debug:           true,
						cache:           true,
						db_username:     null,
						db_password:     null,
						db_url:          null,
						db_name:         null,
						db_cache: {
							sessions:    {},
							users:     {},
							games:       {}
						},
						ws_config: {
							autoAcceptConnections: false
						}
					}
				}
			}
			catch (error) {
				logError(error)
				return false
			}
		}

	/* getContentType */
		module.exports.getContentType = getContentType
		function getContentType(string) {
			try {
				const array = string.split(".")
				const extension = array[array.length - 1].toLowerCase()

				switch (extension) {
					// application
						case "json":
						case "pdf":
						case "rtf":
						case "xml":
						case "zip":
							return `application/${extension}`
						break

					// font
						case "otf":
						case "ttf":
						case "woff":
						case "woff2":
							return `font/${extension}`
						break

					// audio
						case "aac":
						case "midi":
						case "wav":
							return `audio/${extension}`
						break
						case "mid":
							return "audio/midi"
						break
						case "mp3":
							return "audio/mpeg"
						break
						case "oga":
							return "audio/ogg"
						break
						case "weba":
							return "audio/webm"
						break

					// images
						case "iso":
						case "bmp":
						case "gif":
						case "jpeg":
						case "png":
						case "tiff":
						case "webp":
							return `image/${extension}`
						break
						case "jpg":
							return "image/jpeg"
						break
						case "svg":
							return "image/svg+xml"
						break
						case "tif":
							return "image/tiff"
						break

					// video
						case "mpeg":
						case "webm":
							return `video/${extension}`
						break
						case "ogv":
							return "video/ogg"
						break

					// text
						case "css":
						case "csv":
						case "html":
							return `text/${extension}; charset=utf-8`
						break
						case "js":
							return "text/javascript; charset=utf-8"
						break
						case "md":
							return "text/html; charset=utf-8"
						break
						case "txt":
						default:
							return "text/plain; charset=utf-8"
						break
				}
			}
			catch (error) {logError(error)}
		}

	/* getSchema */
		module.exports.getSchema = getSchema
		function getSchema(index) {
			try {
				switch (index) {
					// core
						case "query":
							return {
								collection: null,
								command:    null,
								filters:    null,
								document:   null,
								options:    {}
							}
						break

						case "session":
							return {
								id:               generateRandom(),
								updated:          new Date().getTime(),
								userId:           null,
								gameId:           null,
								info: {
									"ip":         null,
									"user-agent": null,
									"language":   null
								}
							}
						break

					// user
						case "user":
							const CONSTANTS = getAsset("constants")

							return {
								id:           generateRandom(),
								updated:      new Date().getTime(),
								name:         "",
								secret: {
									salt:     null,
									hash:     ""
								},
								gameId:       null,
								games:        {},
								stats: {
									shots:    0,
									stuns:    0,
									timeIn:   0,
									timeOut:  0,
									wins:     0,
									losses:   0
								}
							}
						break

					// game
						case "game":
							return {
								id:              generateRandom(),
								updated:         new Date().getTime(),
								creatorId:       null,
								mode: {
									name:        null,
									description: null
								},
								timeStart:       0,
								timeEnd:         0,
								players:         {},
								banned:          {}
							}
						break

						case "player":
							return {
								userId:    null,
								connected: false,
								name:      "",
								target:    null,
								cooldown:  0,
								shots:     0,
								stuns:     0,
								timeIn:    0,
								timeOut:   0,
								win:       false,
								loss:      false
							}
						break

					// other
						default:
							return null
						break
				}
			}
			catch (error) {
				logError(error)
				return false
			}
		}

	/* getAsset */
		module.exports.getAsset = getAsset
		function getAsset(index) {
			try {
				switch (index) {
					// web
						case "title":
							return `PhotoShots`
						break
						case "logo":
							return `<link rel="shortcut icon" href="logo.png"/>`
						break
						case "description":
							return `photography hide and seek`
						break
						case "meta":
							const title = getAsset("title")
							const description = getAsset("description")
							return `<meta charset="UTF-8"/>\n
									<meta name="description" content="${title}: ${description}"/>\n
									<meta name="author" content="James Mayr"/>\n
									<meta property="og:title" content="${title}"/>\n
									<meta property="og:description" content="${title}: ${description}"/>\n
									<meta property="og:image" content="https://jamesmayr.com/${title.toLowerCase()}/banner.png"/>\n
									<meta name="viewport" content="width=device-width, initial-scale=1.0, minimum-scale=1.0, maximum-scale=1.0"/>`
						break
						case "fonts":
							return `<link href="https://fonts.googleapis.com/css2?family=Alata&display=swap" rel="stylesheet">`
						break
						case "css-variables":
							// output
								const cssVariables = []

							// colors
								const colors = getAsset("colors")
								for (const i in colors) {
									cssVariables.push(`--${i}: ${colors[i]};`)
								}

							// sizes
								const sizes = getAsset("sizes")
								for (const i in sizes) {
									cssVariables.push(`--${i}: ${sizes[i]}px;`)
								}

							// other styling
								const styling = getAsset("styling")
								for (const i in styling) {
									cssVariables.push(`--${i}: ${styling[i]};`)
								}

							// fonts
								const fontString = getAsset("fonts")
								const fontNames = fontString.slice(fontString.indexOf("family=") + "family=".length, fontString.indexOf("&display=")).split("|")
								for (const index in fontNames) {
									const font = fontNames[index].replace(/\+/g, " ").split(":")[0]
									cssVariables.push(`--font-${index}: "${font}", sans-serif;`)
								}

							// return
								return `<style>:root {\n${cssVariables.join("\n")}\n}</style>`
						break

					// styling
						case "colors":
							return {
								"light-gray": "#dddddd",
								"medium-gray": "#555555",
								"dark-gray": "#111111",
								"light-blue": "#04b1ff",
								"medium-blue": "#0066aa",
								"dark-blue": "#003377",
								"medium-red": "#d94c4c"
							}
						break
						case "sizes":
							return {
								"shadow-size": 10,
								"border-radius": 20,
								"border-size": 2,
								"small-gap-size": 5,
								"medium-gap-size": 10,
								"large-gap-size": 20,
								"small-font-size": 15,
								"medium-font-size": 20,
								"large-font-size": 35,
								"huge-font-size": 50
							}
						break
						case "styling":
							return {
								"transition-time": "0.5s",
								"hover-brightness": 0.75,
							}
						break

					// constants
						case "constants":
							return {
								userPathRegex: /^\/user\/[a-zA-Z0-9_]{8,16}$/,
								userNameRegex: /^[a-zA-Z0-9_]{8,16}$/,
								passwordRegex: /^.{8,64}$/,
								gamePathRegex: /^\/game\/[a-z]{8}$/,
								idSet: "abcdefghijklmnopqrstuvwxyz",
								idLength: 8,
								minPlayers: 3,
								maxPlayers: 16,
								gameModes: {
									"fifteen_minutes_of_fame": {
										name: "15 minutes of fame",
										winCondition: "Player with the most shots at game end wins.",
										endCondition: "Game ends after 15 minutes."
									},
									"last_one_standing": {
										name: "last one standing",
										winCondition: "Last player in when everyone else is out wins.",
										endCondition: "If no one wins after 15 minutes, most time in wins."
									},
									"ten_minutes_in": {
										name: "10 min in",
										winCondition: "First player to be in 10 minutes more than they're out wins.",
										endCondition: "If no one wins after 15 minutes, most time in wins."
									},
									"straight_shooter": {
										name: "str8 shooter",
										winCondition: "First player to have 8 shots more than they have stuns wins.",
										endCondition: "If no one wins after 15 minutes, most shots - stuns wins."
									},
									"one_stun_done": {
										name: "one stun done",
										winCondition: "Last player to be stunned wins after each other player is stunned.",
										endCondition: "If no one wins after 15 minutes, any players with 0 stuns win."
									}
								}
							}
						break

					// other
						default:
							return null
						break
				}
			}
			catch (error) {
				logError(error)
				return null
			}
		}

/*** tools ***/
	/* convertTime */
		module.exports.convertTime = convertTime
		function convertTime(seconds) {
			try {
				if (isNaN(seconds)) {
					return seconds
				}

				return `${Math.floor(seconds / 60)}:${('00' + Math.floor(seconds % 60)).slice(-2)}`
			} catch (error) {
				logError(error)
				return seconds
			}
		}

	/* renderHTML */
		module.exports.renderHTML = renderHTML
		function renderHTML(REQUEST, path, callback) {
			try {
				const html = {}
				FS.readFile(path, "utf8", (error, file) => {
					if (error) {
						logError(error)
						callback(``)
						return
					}

					html.original = file
					html.array = html.original.split(/<script\snode>|<\/script\snode>/gi)

					for (html.count = 1; html.count < html.array.length; html.count += 2) {
						try {
							html.temp = eval(html.array[html.count])
						}
						catch (error) {
							html.temp = ""
							logError(`${path}: <sn>${Math.ceil(html.count / 2)}</sn>\n${error}`)
						}
						html.array[html.count] = html.temp
					}

					callback(html.array.join(""))
				})
			}
			catch (error) {
				logError(error)
				callback(``)
			}
		}

	/* constructHeaders */
		module.exports.constructHeaders = constructHeaders
		function constructHeaders(REQUEST) {
			try {
				// asset
					if (REQUEST.method == "GET" && (REQUEST.fileType || !REQUEST.session)) {
						return {"Content-Type": REQUEST.contentType}
					}

				// get
					if (REQUEST.method == "GET") {
						const currentTime = new Date().getTime()
						const cookieLength = getAsset("constants").cookieLength
						const expiration = new Date(currentTime + cookieLength).toUTCString()
						return {
							"Set-Cookie": `session=${REQUEST.session.id}; expires=${expiration}; path=/; domain=${ENVIRONMENT.domain}; SameSite=Strict;`,
							"Content-Type": `text/html; charset=utf-8`
						}
					}

				// post
					return {"Content-Type": `application/json`}
			}
			catch (error) {
				logError(error)
				return {"Content-Type": `application/json`}
			}
		}

	/* duplicateObject */
		function duplicateObject(obj) {
			try {
				if (typeof obj !== "object") {
					return obj
				}

				return JSON.parse(JSON.stringify(obj))
			} catch (error) {
				logError(error)
				return obj
			}
		}

	/* chooseRandom */
		module.exports.chooseRandom = chooseRandom
		function chooseRandom(list) {
			try {
				// array
					if (Array.isArray(list)) {
						return list[Math.floor(Math.random() * list.length)]	
					}

				// object
					if (typeof list == "object") {
						return list[chooseRandom(Object.keys(list))]
					}

				// string
					if (typeof list == "string") {
						return chooseRandom(list.split(""))
					}

				// other
					return list
			}
			catch (error) {
				logError(error)
				return list
			}
		}

	/* sortRandom */
		module.exports.sortRandom = sortRandom
		function sortRandom(list) {
			try {
				if (!Array.isArray(list)) {
					return list
				}
				
				const listCopy = duplicateObject(list)

				let x = listCopy.length
				while (x > 0) {
					const y = Math.floor(Math.random() * x)
					x -= 1
					const temp = listCopy[x]
					listCopy[x] = listCopy[y]
					listCopy[y] = temp
				}

				return listCopy
			}
			catch (error) {
				logError(error)
				return list
			}
		}

	/* generateRandom */
		module.exports.generateRandom = generateRandom
		function generateRandom(options) {
			try {
				const CONSTANTS = getAsset("constants")
				const set    = options && options.set    ? options.set    : CONSTANTS.idSet
				const length = options && options.length ? options.length : CONSTANTS.idLength

				return new Array(length).fill(null).map(slot => chooseRandom(set)).join("")
			}
			catch (error) {
				logError(error)
				return null
			}
		}

	/* hashRandom */
		module.exports.hashRandom = hashRandom
		function hashRandom(text, storedSalt) {
			try {
				const salt = storedSalt ? storedSalt : CRYPTO.randomBytes(512 / 8).toString("hex")
				const hash = CRYPTO.createHmac("sha512", salt).update(text).digest("hex")
				return {hash, salt}
			}
			catch (error) {
				logError(error)
				return {salt: null, hash: null}
			}
		}

/*** database ***/
	/* documentMeetsFilter */
		module.exports.meetsFilters = meetsFilters
		function meetsFilters(document, filters) {
			try {
				// loop through filters
					for (const property in filters) {
						const filterValue = filters[property]
						
						if (filterValue instanceof RegExp) {
							if (!filterValue.test(document[property])) {
								return false
							}
						}
						else {
							if (filterValue !== document[property]) {
								return false
							}
						}
					}

				// still here --> true
					return true
			}
			catch (error) {
				logError(error)
				return false
			}
		}

	/* accessDatabase */
		module.exports.accessDatabase = accessDatabase
		function accessDatabase(query, callback) {
			try {
				// no query?
					if (!query) {
						if (typeof ENVIRONMENT.db_cache !== "object") {
							callback({success: false, message: `invalid database`})
							return
						}
						callback(ENVIRONMENT.db_cache)
						return
					}

				// log
					logMessage(`db:${query.command} ${query.collection}` + 
						(query.filters  ? `\n   > ${JSON.stringify(query.filters) }` : "") +
						(query.document ? `\n   > ${Object.keys(query.document).join(", ")}` : ""))

				// go to Mongo
					if (ENVIRONMENT.db_url) {
						accessMongo(query, callback)
						return
					}

				// no database?
					if (!ENVIRONMENT.db_cache) {
						logError(`database not found`)
						callback({success: false, message: `database not found`})
						return
					}

				// collection
					if (!ENVIRONMENT.db_cache[query.collection]) {
						logError(`collection not found`)
						callback({success: false, message: `collection not found`})
						return
					}

				// find
					if (query.command == "find") {
						// filtered documentKeys
							const documentKeys = Object.keys(ENVIRONMENT.db_cache[query.collection]).filter(key => meetsFilters(ENVIRONMENT.db_cache[query.collection][key], query.filters))

						// no documentKeys
							if (!documentKeys.length) {
								callback({success: false, count: 0, documents: []})
								return
							}

						// get documents
							const documents = documentKeys.map(key => duplicateObject(ENVIRONMENT.db_cache[query.collection][key]))

						// confirmation
							callback({success: true, count: documents.length, documents: documents})
							return
					}

				// insert
					if (query.command == "insert") {
						// unique id
							let id = null
							do {
								id = generateRandom()
							}
							while (ENVIRONMENT.db_cache[query.collection][id])

						// insert document
							ENVIRONMENT.db_cache[query.collection][id] = duplicateObject(query.document)

						// confirmation
							callback({success: true, count: 1, documents: [query.document]})
							return
					}

				// update
					if (query.command == "update") {
						// filtered documentKeys
							const documentKeys = Object.keys(ENVIRONMENT.db_cache[query.collection]).filter(key => meetsFilters(ENVIRONMENT.db_cache[query.collection][key], query.filters))

						// no documentKeys
							if (!documentKeys.length) {
								callback({success: false, count: 0, documents: []})
								return
							}

						// fields to update
							const updateKeys = Object.keys(query.document)

						// update documents
							for (const key of documentKeys) {
								const document = ENVIRONMENT.db_cache[query.collection][key]

								for (const pathString of updateKeys) {
									const pathList = pathString.split(".")
									
									let subdocument = document
									let level = 0
									while (level < pathList.length - 1) {
										if (typeof subdocument[pathList[level]] == "undefined") {
											subdocument[pathList[level]] = {}
										}
										subdocument = subdocument[pathList[level]]
										level++
									}
									
									if (query.document[pathString] === undefined) {
										delete subdocument[pathList[level]]
									}
									else {
										subdocument[pathList[level]] = query.document[pathString]
									}
								}
							}

						// get updated documents
							const documents = documentKeys.map(key => duplicateObject(ENVIRONMENT.db_cache[query.collection][key]))

						// confirmation
							callback({success: true, count: documents.length, documents: documents})
							return
					}

				// delete
					if (query.command == "delete") {
						// filtered documentKeys
							const documentKeys = Object.keys(ENVIRONMENT.db_cache[query.collection]).filter(key => meetsFilters(ENVIRONMENT.db_cache[query.collection][key], query.filters))

						// no documents
							if (!documentKeys.length) {
								callback({success: false, count: 0})
							}

						// delete
							for (const key of documentKeys) {
								delete ENVIRONMENT.db_cache[query.collection][key]
							}

						// confirmation
							callback({success: true, count: documentKeys.length})
							return
					}
			}
			catch (error) {
				logError(error)
				callback({success: false, message: `unable to ${arguments.callee.name}`})
			}
		}

	/* accessMongo */
		module.exports.accessMongo = accessMongo
		function accessMongo(query, callback) {
			try {
				// find
					if (query.command == "find") {
						// find in cache
							if (ENVIRONMENT.cache) {
								// all documents
									const documentKeys = Object.keys(ENVIRONMENT.db_cache[query.collection]).filter(key => meetsFilters(ENVIRONMENT.db_cache[query.collection][key], query.filters))

								// get documents
									const documents = documentKeys.map(key => duplicateObject(ENVIRONMENT.db_cache[query.collection][key]))

								// documents in cache
									if (documents && documents.length) {
										callback({success: true, count: documents.length, documents: documents})
										return
									}
							}

						// connect
							logMessage(`db: connecting`)
							MONGO.connect(ENVIRONMENT.db, {useNewUrlParser: true, useUnifiedTopology: true}, (error, client) => {
								// connect
									if (error) {
										logError(error)
										callback({success: false, message: error})
										try { client.close() } catch (error) {}
										return
									}

									const db = client.db(ENVIRONMENT.db_name)

								// execute query
									db.collection(query.collection).find(query.filters).toArray((error, documents) => {
										// error
											if (error) {
												callback({success: false, message: JSON.stringify(error)})
												client.close()
												return
											}

										// no documents
											if (!documents.length) {
												callback({success: false, count: 0, documents: []})
												client.close()
												return
											}

										// yes documents
											// update cache
												if (ENVIRONMENT.cache) {
													for (const i in documents) {
														ENVIRONMENT.db_cache[query.collection][documents[i]._id] = duplicateObject(documents[i])
													}
												}

											// return documents
												callback({success: true, count: documents.length, documents: documents})
												client.close()
												return
									})
							})
					}

				// insert
					if (query.command == "insert") {
						// prevent duplicate _id
							if (query.document._id) {
								delete query.document._id
							}

						// connect
							logMessage(`db: connecting`)
							MONGO.connect(ENVIRONMENT.db, {useNewUrlParser: true, useUnifiedTopology: true}, (error, client) => {
								// connect
									if (error) {
										logError(error)
										callback({success: false, message: error})
										try { client.close() } catch (error) {}
										return
									}

									const db = client.db(ENVIRONMENT.db_name)

								// execute query
									db.collection(query.collection).insertOne(query.document, (error, results) => {
										// error
											if (error) {
												callback({success: false, message: JSON.stringify(error)})
												client.close()
												return
											}

										// success
											// update cache
												if (ENVIRONMENT.cache) {
													ENVIRONMENT.db_cache[query.collection][results.insertedId] = duplicateObject(query.document)
												}

											// return documents
												callback({success: true, count: results.nInserted, documents: [query.document]})
												client.close()
												return
									})
							})
					}

				// update
					if (query.command == "update") {
						// prevent updating _id
							if (query.document._id) {
								delete query.document._id
							}

						// connect
							logMessage(`db: connecting`)
							MONGO.connect(ENVIRONMENT.db, {useNewUrlParser: true, useUnifiedTopology: true}, (error, client) => {
								// connect
									if (error) {
										logError(error)
										callback({success: false, message: error})
										try { client.close() } catch (error) {}
										return
									}

									const db = client.db(ENVIRONMENT.db_name)

								// set vs. unset
									const updateKeys = Object.keys(query.document)
									const sets = {}
									const unsets = {}
									for (const key of updateKeys) {
										const value = query.document[key]
										if (value === undefined) {
											unsets[key] = null
										}
										else {
											sets[key] = value
										}
									}

								// updateQuery
									const setsAndUnsets = {}
									if (Object.keys(sets).length) {
										setsAndUnsets["$set"] = sets
									}
									if (Object.keys(unsets).length) {
										setsAndUnsets["$unset"] = unsets
									}

								// execute query
									db.collection(query.collection).updateOne(query.filters, setsAndUnsets, (error, results) => {
										// error
											if (error) {
												callback({success: false, message: JSON.stringify(error)})
												client.close()
												return
											}

										// find
											db.collection(query.collection).find(query.filters).toArray((error, documents) => {
												// error
													if (error) {
														callback({success: false, message: JSON.stringify(error)})
														client.close()
														return
													}

												// no documents
													if (!documents.length) {
														callback({success: false, count: 0, documents: []})
														client.close()
														return
													}

												// yes documents
													// update cache
														if (ENVIRONMENT.cache) {
															for (const i in documents) {
																ENVIRONMENT.db_cache[query.collection][documents[i]._id] = duplicateObject(documents[i])
															}
														}

													// return documents
														callback({success: true, count: documents.length, documents: documents})
														client.close()
														return
											})
									})
							})
					}

				// delete
					if (query.command == "delete") {
						// connect
							logMessage(`db: connecting`)
							MONGO.connect(ENVIRONMENT.db, {useNewUrlParser: true, useUnifiedTopology: true}, (error, client) => {
								// connect
									if (error) {
										logError(error)
										callback({success: false, message: error})
										try { client.close() } catch (error) {}
										return
									}

									const db = client.db(ENVIRONMENT.db_name)

								// get _ids
									db.collection(query.collection).find(query.filters).toArray((error, documents) => {
										// error
											if (error) {
												callback({success: false, message: JSON.stringify(error)})
												client.close()
												return
											}

										// no documents
											if (!documents.length) {
												callback({success: true, count: 0})
												client.close()
												return
											}

										// yes documents --> store _ids
											const _ids = documents.map(document => document._id)
										
										// delete
											db.collection(query.collection).deleteMany(query.filters, (error, results) => {
												// error
													if (error) {
														callback({success: false, message: JSON.stringify(error)})
														client.close()
														return
													}

												// no documents any more
													// update cache
														if (ENVIRONMENT.cache) {
															for (const _id of _ids) {
																delete ENVIRONMENT.db_cache[query.collection][_id]
															}
														}

													// return documents
														callback({success: true, count: results.deletedCount})
														client.close()
														return
											})
									})
							})
					}
			}
			catch (error) {
				logError(error)
				callback({success: false, message: `unable to ${arguments.callee.name}`})
			}
		}
