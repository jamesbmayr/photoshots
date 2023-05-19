/*** modules ***/
	const CORE = require("../node/core")
	const USER = require("../node/user")
	module.exports = {}

/*** constants ***/
	const CONSTANTS = CORE.getAsset("constants")

/*** REQUEST ***/
	/* createOne */
		module.exports.createOne = createOne
		function createOne(REQUEST, callback) {
			try {
				// authenticated?
					if (!REQUEST.session.userId) {
						callback({success: false, message: `not logged in`})
						return
					}

				// get user
					USER.readOne(REQUEST.session.userId, null, results => {
						if (!results.success) {
							callback(results)
							return
						}

						// user
							const user = results.user
							delete user.secret

						// in another game?
							if (user.gameId) {
								callback({success: false, message: `already in game ${user.gameId}`})
								return
							}

						// new game
							const game = CORE.getSchema("game")
								game.creatorId = REQUEST.session.userId

						// add player
							const player = CORE.getSchema("player")
								player.userId = user.id
								player.name = user.name
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

								// update user
									USER.setGame(REQUEST.session.userId, gameId, results => {
										if (!results.success) {
											callback(results)
											return
										}
										
										callback({success: true, message: `game created`, location: `/game/${gameId}`})
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
					const gameId = REQUEST.post.gameId
					if (!gameId || !CONSTANTS.gamePathRegex.test(`/game/${gameId}`)) {
						callback({success: false, message: `invalid game id`})
						return
					}

				// query
					const query = CORE.getSchema("query")
						query.collection = "games"
						query.command = "find"
						query.filters = {id: gameId}

				// find
					CORE.accessDatabase(query, results => {
						if (!results.success) {
							callback({success: false, message: `game not found`})
							return
						}

						// game found
							const game = results.documents[0]

						// already over?
							if (game.timeEnd) {
								callback({success: false, message: `game already ended`})
								return
							}

						// too many players
							if (!game.players[REQUEST.session.userId] && Object.keys(game.players).length >= CONSTANTS.maxPlayers) {
								callback({success: false, message: `game is at maximum player count`})
								return
							}

						// get user
							USER.readOne(REQUEST.session.userId, null, results => {
								if (!results.success) {
									callback(results)
									return
								}

								// user
									const user = results.user
									delete user.secret

								// in another game?
									if (user.gameId && user.gameId !== gameId) {
										callback({success: false, message: `already in game ${user.gameId}`})
										return
									}

								// already joined --> redirect
									if (game.players[user.id]) {
										USER.setGame(user.id, gameId, results => {
											if (!results.success) {
												callback(results)
												return
											}

											callback({success: true, message: `rejoining game`, location: `/game/${gameId}`})
										})
										return
									}

								// add player
									const player = CORE.getSchema("player")
										player.userId = user.id
										player.name = user.name

								// query
									const query = CORE.getSchema("query")
										query.collection = "games"
										query.command = "update"
										query.filters = {id: gameId}
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

										// add user / session to this game
											USER.setGame(user.id, gameId, results => {
												if (!results.success) {
													callback(results)
													return
												}
												
												callback({success: true, message: `joining game`, location: `/game/${gameId}`})
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

/*** WEBSOCKETS ***/
	/* leaveOne */
		module.exports.leaveOne = leaveOne
		function leaveOne(REQUEST, callback) {
			try {
				// authenticated?
					if (!REQUEST.session.userId) {
						callback({success: false, message: `not logged in`})
						return
					}

				// validate
					const gameId = REQUEST.post.gameId
					if (!gameId || !CONSTANTS.gamePathRegex.test(`/game/${gameId}`)) {
						callback({success: false, message: `invalid game id`})
						return
					}

				// query
					const query = CORE.getSchema("query")
						query.collection = "games"
						query.command = "find"
						query.filters = {id: gameId}

				// find
					CORE.accessDatabase(query, results => {
						if (!results.success) {
							callback({success: false, message: `game not found`})
							return
						}

						// game found
							const game = results.documents[0]

						// not in game
							if (!game.players[REQUEST.session.userId]) {
								callback({success: false, message: `not in game`})
								return
							}

						// ???
							// re-targetng

						// query
							const query = CORE.getSchema("query")
								query.collection = "games"
								query.command = "update"
								query.filters = {id: gameId}
								query.document = {
									updated: new Date().getTime(),
									[`players.${REQUEST.session.userId}`]: undefined
								}

						// update
							CORE.accessDatabase(query, results => {
								if (!results.success) {
									callback({success: false, message: `unable to leave game`})
									return
								}

								// remove user / session to this game
									USER.setGame(REQUEST.session.userId, null, results => {
										if (!results.success) {
											callback(results)
											return
										}
										
										callback({success: true, message: `leaving game`, location: `/`})
									})
							})
					})
			}
			catch (error) {
				CORE.logError(error)
				callback({success: false, message: `unable to ${arguments.callee.name}`})
			}
		}

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

	/* deleteOne */
		module.exports.deleteOne = deleteOne
		function deleteOne(REQUEST, callback) {
			try {
				// authenticated?
					if (!REQUEST.session.userId) {
						callback({success: false, message: `not logged in`})
						return
					}

				// validate
					const gameId = REQUEST.post.gameId
					if (!gameId || !CONSTANTS.gamePathRegex.test(`/game/${gameId}`)) {
						callback({success: false, message: `invalid game id`})
						return
					}

				// query
					const query = CORE.getSchema("query")
						query.collection = "games"
						query.command = "find"
						query.filters = {id: gameId}

				// find
					CORE.accessDatabase(query, results => {
						if (!results.success) {
							callback({success: false, message: `game not found`})
							return
						}

						// not the creator
							const game = results.documents[0]
							if (game.creatorId !== REQUEST.session.userId) {
								callback({success: false, message: `not the game creator`})
								return
							}

						// all users
							const userIds = Object.keys(game.players)

						// query
							const query = CORE.getSchema("query")
								query.collection = "games"
								query.command = "delete"
								query.filters = {id: gameId}

						// delete
							CORE.accessDatabase(query, results => {
								if (!results.success) {
									callback({success: false, message: `unable to delete game`})
									return
								}

								// update users
									for (const userId of userIds) {
										USER.setGame(userId, null, data => {
											// websocket message ???
										})
									}
							})
					})
			}
			catch (error) {
				CORE.logError(error)
				callback({success: false, message: `unable to ${arguments.callee.name}`})
			}
		}

/*** OTHER ***/
	/* readOne */
		module.exports.readOne = readOne
		function readOne(gameId, callback) {
			try {
				// validate
					if (!gameId || !CONSTANTS.gamePathRegex.test(`/game/${gameId}`)) {
						callback({success: false, message: `invalid game id`})
						return
					}

				// query
					const query = CORE.getSchema("query")
						query.collection = "games"
						query.command = "find"
						query.filters = {id: gameId}

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
