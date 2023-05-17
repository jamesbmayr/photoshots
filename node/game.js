/*** modules ***/
	const CORE = require("../node/core")
	module.exports = {}

/*** constants ***/
	const CONSTANTS = CORE.getAsset("constants")

/*** creates ***/
	/* createOne */
		module.exports.createOne = createOne
		function createOne(REQUEST, callback) {
			try {
				// authenticated?
					if (!REQUEST.session.userId) {
						callback({success: false, message: `not logged in`})
						return
					}

				// new game
					const game = CORE.getSchema("game")
						game.userId = REQUEST.session.userId

				// add player
					const player = CORE.getSchema("player")
						player.userId = REQUEST.session.userId
					game.players[player.userId] = player

				// query
					const query = CORE.getSchema("query")
						query.collection = "games"
						query.command = "insert"
						query.document = game

				// insert
					CORE.accessDatabase(query, results => {
						if (!results.success) {
							callback({success: false, message: `unable to create game`})
							return
						}

						// game
							const gameId = results.documents[0].id

						// query
							const query = CORE.getSchema("query")
								query.collection = "users"
								query.command = "update"
								query.filters = {id: REQUEST.session.userId}
								query.document = {
									updated: new Date().getTime(),
									gameId: gameId
								}

						// update
							CORE.accessDatabase(query, results => {
								if (!results.success) {
									callback({success: false, message: `unable to update user`})
									return
								}

								// query
									const query = CORE.getSchema("query")
										query.collection = "sessions"
										query.command = "update"
										query.filters = {id: REQUEST.session.id}
										query.document = {
											updated: new Date().getTime(),
											gameId: gameId
										}

								// update
									CORE.accessDatabase(query, results => {
										if (!results.success) {
											callback({success: false, message: `unable to update session`})
											return
										}

										// refresh
											callback({success: true, message: `game created`, location: `/game/${gameId}`})
											return
									})
							})
					})
			}
			catch (error) {
				CORE.logError(error)
				callback({success: false, message: `unable to ${arguments.callee.name}`})
			}
		}

	/* joinOne */
		module.exports.joinOne = joinOne
		function joinOne(REQUEST, callback) {
			try {
				// authenticated?
					if (!REQUEST.session.userId) {
						callback({success: false, message: `not logged in`})
						return
					}

				// validate
					if (!REQUEST.post.gameId || !CONSTANTS.gamePathRegex.test(`/game/${REQUEST.post.gameId}`)) {
						callback({success: false, message: `invalid game id`})
						return
					}

				// query
					const query = CORE.getSchema("query")
						query.collection = "games"
						query.command = "find"
						query.filters = {id: REQUEST.post.gameId}

				// find
					CORE.accessDatabase(query, results => {
						if (!results.success) {
							callback({success: false, message: `game not found`})
							return
						}

						// game found
							const game = results.documents[0]
							const gameId = game.id

						// already over?
							if (game.timeEnd) {
								callback({success: false, message: `game already ended`})
								return
							}

						// already joined --> redirect
							if (game.players[REQUEST.post.userId]) {
								callback({success: true, message: `joining game`, location: `/game/${gameId}`})
								return
							}

						// too many players
							if (Object.keys(game.players).length >= CONSTANTS.maxPlayers) {
								callback({success: false, message: `game is at maximum player count`})
								return
							}

						// add player
							const player = CORE.getSchema("player")
								player.userId = REQUEST.session.userId

						// query
							const query = CORE.getSchema("query")
								query.collection = "games"
								query.command = "update"
								query.filters = {id: REQUEST.session.userId}
								query.document = {
									updated: new Date().getTime(),
									[`players.${player.userId}`]: player
								}

						// update
							CORE.accessDatabase(query, results => {
								if (!results.success) {
									callback({success: false, message: `unable to join game`})
									return
								}

								// query
									const query = CORE.getSchema("query")
										query.collection = "users"
										query.command = "update"
										query.filters = {id: REQUEST.session.userId}
										query.document = {
											updated: new Date().getTime(),
											gameId: gameId
										}

								// update
									CORE.accessDatabase(query, results => {
										if (!results.success) {
											callback({success: false, message: `unable to update user`})
											return
										}

										// query
											const query = CORE.getSchema("query")
												query.collection = "sessions"
												query.command = "update"
												query.filters = {id: REQUEST.session.id}
												query.document = {
													updated: new Date().getTime(),
													gameId: gameId
												}

										// update
											CORE.accessDatabase(query, results => {
												if (!results.success) {
													callback({success: false, message: `unable to update session`})
													return
												}

												// refresh
													callback({success: true, location: `/game/${gameId}`})
													return
											})
									})
							})
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
		function readOne(REQUEST, callback) {
			try {
				// validate
					if (!REQUEST.post.gameId || !CONSTANTS.gamePathRegex.test(`/game/${REQUEST.post.gameId}`)) {
						callback({success: false, message: `invalid game id`})
						return
					}

				// query
					const query = CORE.getSchema("query")
						query.collection = "games"
						query.command = "find"
						query.filters = {id: REQUEST.post.gameId}

				// find
					CORE.accessDatabase(query, results => {
						if (!results.success) {
							callback({success: false, message: `game not found`})
							return
						}

						// game found
							const game = results.documents[0]

						// return data
							callback({success: true, game: game})
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
		function updateOne(REQUEST, callback) {
			try {
				// authenticated?
					if (!REQUEST.session.userId) {
						callback({success: false, message: `not logged in`})
						return
					}

				// not in game
					if (!REQUEST.session.gameId) {
						callback({success: false, message: `not in a game`})
						return
					}

				// query
					const query = CORE.getSchema("query")
						query.collection = "games"
						query.command = "find"
						query.filters = {id: REQUEST.session.gameId}

				// find
					CORE.accessDatabase(query, results => {
						if (!results.success) {
							callback({success: false, message: `game not found`})
							return
						}

						// game found
							const game = results.documents[0]

						// action
							switch (REQUEST.post.action) {
								case "???":
									// ???(REQUEST, callback)
								break
								default:
									callback({success: false, message: `unknown game update operation`})
								break
							}
					})
			}
			catch (error) {
				CORE.logError(error)
				callback({success: false, message: `unable to ${arguments.callee.name}`})
			}
		}
