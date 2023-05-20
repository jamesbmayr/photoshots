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
	/* setConnect */
		module.exports.setConnect = setConnect
		function setConnect(REQUEST, connected, callback) {
			try {
				// validate
					const gameId = REQUEST.path[REQUEST.path.length - 1]
					if (!gameId || !CONSTANTS.gamePathRegex.test(`/game/${gameId}`)) {
						callback({success: false, message: `invalid game id`, recipients: [REQUEST.session.userId]})
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
							callback({success: false, message: `game not found`, recipients: [REQUEST.session.userId]})
							return
						}

						// not a player
							if (!results.documents[0].players[REQUEST.session.userId]) {
								callback({success: false, message: `not a player`, recipients: [REQUEST.session.userId]})
								return
							}

						// query
							const query = CORE.getSchema("query")
								query.collection = "games"
								query.command = "update"
								query.filters = {id: gameId}
								query.document = {
									updated: new Date().getTime(),
									[`players.${REQUEST.session.userId}.connected`]: connected || false
								}

						// update
							CORE.accessDatabase(query, results => {
								if (!results.success) {
									callback({success: false, message: `game not found`, recipients: [REQUEST.session.userId]})
									return
								}

								const game = results.documents[0]
								callback({success: true, message: `${game.players[REQUEST.session.userId].name} ${connected ? "connected" : "disconnected"}`, game: game, recipients: Object.keys(game.players)})
							})
					})
			}
			catch (error) {
				CORE.logError(error)
				callback({success: false, message: `unable to ${arguments.callee.name}`})
			}
		}

	/* quitOne */
		module.exports.quitOne = quitOne
		function quitOne(REQUEST, callback) {
			try {
				// validate
					const gameId = REQUEST.session.gameId
					if (!gameId || !CONSTANTS.gamePathRegex.test(`/game/${gameId}`)) {
						callback({success: false, message: `invalid game id`, recipients: [REQUEST.session.userId]})
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
							callback({success: false, message: `game not found`, recipients: [REQUEST.session.userId]})
							return
						}

						// game found
							const game = results.documents[0]

						// not in game
							if (!game.players[REQUEST.session.userId]) {
								callback({success: false, message: `not in game`, recipients: [REQUEST.session.userId]})
								return
							}

						// game ended
							if (game.timeEnd) {
								callback({success: false, message: `game already ended`, recipients: [REQUEST.session.userId]})
								return
							}

						// ???
							// re-targeting

						// name
							const username = game.players[REQUEST.session.userId].name

						// query
							const query = CORE.getSchema("query")
								query.collection = "games"
								query.command = "update"
								query.filters = {id: gameId}
								query.document = {
									updated: new Date().getTime(),
									[`players.${REQUEST.session.userId}`]: undefined
								}

						// reassign creator?
							if (game.creatorId == REQUEST.session.userId) {
								const otherPlayerIds = Object.keys(game.players).filter(playerId => playerId !== REQUEST.session.userId)
								query.document.creatorId = otherPlayerIds ? otherPlayerIds[0] : null
							}

						// update
							CORE.accessDatabase(query, results => {
								if (!results.success) {
									callback({success: false, message: `unable to leave game`, recipients: [REQUEST.session.userId]})
									return
								}

								// game
									const updatedGame = results.documents[0]

								// remove user / session to this game
									USER.setGame(REQUEST.session.userId, null, results => {
										if (!results.success) {
											callback(results)
											return
										}
										
										callback({success: true, message: `quitting game`, location: `/user/${username}`, recipients: [REQUEST.session.userId]})
									})

								// empty game --> delete
									if (!Object.keys(updatedGame.players).length) {
										// query
											const query = CORE.getSchema("query")
												query.collection = "games"
												query.command = "delete"
												query.filters = {id: gameId}
											
										// update
											CORE.accessDatabase(query, results => {})
										return
									}

								// inform others
									callback({success: true, message: `${username} quit the game`, game: updatedGame, recipients: Object.keys(updatedGame.players)})
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
				// not in game
					if (!REQUEST.session.gameId) {
						callback({success: false, message: `not in a game`, recipients: [REQUEST.session.userId]})
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
							callback({success: false, message: `game not found`, recipients: [REQUEST.session.userId]})
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
									callback({success: false, message: `unknown game update operation`, recipients: [REQUEST.session.userId]})
								break
							}
					})
			}
			catch (error) {
				CORE.logError(error)
				callback({success: false, message: `unable to ${arguments.callee.name}`, recipients: [REQUEST.session.userId]})
			}
		}

	/* deleteOne */
		module.exports.deleteOne = deleteOne
		function deleteOne(REQUEST, callback) {
			try {
				// validate
					const gameId = REQUEST.session.gameId
					if (!gameId || !CONSTANTS.gamePathRegex.test(`/game/${gameId}`)) {
						callback({success: false, message: `invalid game id`, recipients: [REQUEST.session.userId]})
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
							callback({success: false, message: `game not found`, recipients: [REQUEST.session.userId]})
							return
						}

						// not the creator
							const game = results.documents[0]
							if (game.creatorId !== REQUEST.session.userId) {
								callback({success: false, message: `not the game creator`, recipients: [REQUEST.session.userId]})
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
									callback({success: false, message: `unable to delete game`, recipients: [REQUEST.session.userId]})
									return
								}

								// update users
									for (const userId of userIds) {
										USER.setGame(userId, null, data => {
											callback({success: false, message: `game deleted`, close: true, recipients: [userId]})
											return
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
