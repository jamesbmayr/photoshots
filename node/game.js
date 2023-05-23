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
								game.ownerId = REQUEST.session.userId

						// random game mode
							const gameModeId = CORE.chooseRandom(Object.keys(CONSTANTS.gameModes))
								game.mode.id = gameModeId
								game.mode.name = CONSTANTS.gameModes[gameModeId].name
								game.mode.winCondition = CONSTANTS.gameModes[gameModeId].winCondition
								game.mode.endCondition = CONSTANTS.gameModes[gameModeId].endCondition

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

						// banned?
							if (game.banned[REQUEST.session.userId]) {
								callback({success: false, message: `banned from this game`})
								return
							}

						// already over?
							if (game.timeEnd) {
								callback({success: false, message: `game already ended`})
								return
							}

						// too many players
							if (!game.players[REQUEST.session.userId] && Object.keys(game.players).length >= CONSTANTS.maxPlayers) {
								callback({success: false, message: `game is at maximum player count (${CONSTANTS.maxPlayers})`})
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
				callback({success: false, message: `unable to ${arguments.callee.name}`, recipients: [REQUEST.session.userId]})
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

						// retargeting
							const selfTargeterId = Object.keys(game.players).find(playerId => {
								return game.players[playerId].target == REQUEST.session.userId
							}) || null

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
								if (selfTargeterId) {
									query.document[`players.${selfTargeterId}.target`] = game.players[REQUEST.session.userId].target
								}

						// reassign owner?
							let ownerChanged = false
							if (game.ownerId == REQUEST.session.userId) {
								const otherPlayerIds = Object.keys(game.players).filter(playerId => playerId !== REQUEST.session.userId)
								query.document.ownerId = otherPlayerIds ? otherPlayerIds[0] : null
								ownerChanged = true
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

								// new owner?
									if (ownerChanged && updatedGame.ownerId) {
										callback({success: true, message: `upgraded to game owner`, game: updatedGame, owner: updatedGame.ownerId, recipients: [updatedGame.ownerId]})
									}
							})
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

						// not the owner
							const game = results.documents[0]
							if (game.ownerId !== REQUEST.session.userId) {
								callback({success: false, message: `not the game owner`, recipients: [REQUEST.session.userId]})
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
				callback({success: false, message: `unable to ${arguments.callee.name}`, recipients: [REQUEST.session.userId]})
			}
		}

	/* selectMode */
		module.exports.selectMode = selectMode
		function selectMode(REQUEST, callback) {
			try {
				// game mode
					if (!REQUEST.post.mode || !CONSTANTS.gameModes[REQUEST.post.mode]) {
						callback({success: false, message: `invalid mode`, recipients: [REQUEST.session.userId]})
						return
					}

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

						// not the owner
							const game = results.documents[0]
							if (game.ownerId !== REQUEST.session.userId) {
								callback({success: false, message: `not the game owner`, recipients: [REQUEST.session.userId]})
								return
							}

						// game ended
							if (game.timeEnd) {
								callback({success: false, message: `game already ended`, recipients: [REQUEST.session.userId]})
								return
							}

						// game started
							if (game.timeStart) {
								callback({success: false, message: `game already started`, recipients: [REQUEST.session.userId]})
								return
							}

						// name & description
							const gameMode = CORE.duplicateObject(CONSTANTS.gameModes[REQUEST.post.mode])
								gameMode.id = REQUEST.post.mode

						// query
							const query = CORE.getSchema("query")
								query.collection = "games"
								query.command = "update"
								query.filters = {id: gameId}
								query.document = {
									updated: new Date().getTime(),
									mode: gameMode
								}

						// update
							CORE.accessDatabase(query, results => {
								if (!results.success) {
									callback({success: false, message: `unable to update mode`, recipients: [REQUEST.session.userId]})
									return
								}

								// game
									const updatedGame = results.documents[0]

								// inform others
									callback({success: true, game: updatedGame, recipients: Object.keys(updatedGame.players)})
							})
					})
			}
			catch (error) {
				CORE.logError(error)
				callback({success: false, message: `unable to ${arguments.callee.name}`, recipients: [REQUEST.session.userId]})
			}
		}

	/* banPlayer */
		module.exports.banPlayer = banPlayer
		function banPlayer(REQUEST, callback) {
			try {
				// no playerId
					if (!REQUEST.post.playerId) {
						callback({success: false, message: `invalid player`, recipients: [REQUEST.session.userId]})
						return
					}

				// self
					if (REQUEST.post.playerId == REQUEST.session.userId) {
						callback({success: false, message: `cannot ban self`, recipients: [REQUEST.session.userId]})
						return
					}

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

						// not the owner
							const game = results.documents[0]
							if (game.ownerId !== REQUEST.session.userId) {
								callback({success: false, message: `not the game owner`, recipients: [REQUEST.session.userId]})
								return
							}

						// game ended
							if (game.timeEnd) {
								callback({success: false, message: `game already ended`, recipients: [REQUEST.session.userId]})
								return
							}

						// not in game
							if (!game.players[REQUEST.post.playerId]) {
								callback({success: false, message: `player not in game`, recipients: [REQUEST.session.userId]})
								return
							}

						// name
							const username = game.players[REQUEST.post.playerId].name

						// retargeting
							const banneeTargeterId = Object.keys(game.players).find(playerId => {
								return game.players[playerId].target == REQUEST.post.playerId
							}) || null

						// query
							const query = CORE.getSchema("query")
								query.collection = "games"
								query.command = "update"
								query.filters = {id: gameId}
								query.document = {
									updated: new Date().getTime(),
									[`players.${REQUEST.post.playerId}`]: undefined,
									[`banned.${REQUEST.post.playerId}`]: true
								}
								if (banneeTargeterId) {
									query.document[`players.${banneeTargeterId}.target`] = game.players[REQUEST.post.playerId].target
								}

						// update
							CORE.accessDatabase(query, results => {
								if (!results.success) {
									callback({success: false, message: `unable to ban player`, recipients: [REQUEST.session.userId]})
									return
								}

								// game
									const updatedGame = results.documents[0]

								// remove user / session to this game
									USER.setGame(REQUEST.post.playerId, null, results => {
										if (!results.success) {
											callback(results)
											return
										}
										
										callback({success: true, close: true, message: `banned from game ${updatedGame.id}`, location: `/user/${username}`, recipients: [REQUEST.post.playerId]})
									})

								// inform others
									callback({success: true, message: `${username} was banned`, game: updatedGame, recipients: Object.keys(updatedGame.players)})
							})
					})
			}
			catch (error) {
				CORE.logError(error)
				callback({success: false, message: `unable to ${arguments.callee.name}`, recipients: [REQUEST.session.userId]})
			}
		}

	/* startOne */
		module.exports.startOne = startOne
		function startOne(REQUEST, callback) {
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

						// not the owner
							const game = results.documents[0]
							if (game.ownerId !== REQUEST.session.userId) {
								callback({success: false, message: `not the game owner`, recipients: [REQUEST.session.userId]})
								return
							}

						// game started
							if (game.timeStart) {
								callback({success: false, message: `game already started`, recipients: [REQUEST.session.userId]})
								return
							}

						// not enough players
							if (Object.keys(game.players).length < CONSTANTS.minPlayers) {
								callback({success: false, message: `game is below minimum player count (${CONSTANTS.minPlayers})`, recipients: [REQUEST.session.userId]})
								return
							}

						// no mode selected
							if (!game.mode || !game.mode.id) {
								callback({success: false, message: `no game mode selected`, recipients: [REQUEST.session.userId]})
								return
							}

						// query
							const query = CORE.getSchema("query")
								query.collection = "games"
								query.command = "update"
								query.filters = {id: gameId}
								query.document = {
									updated: new Date().getTime(),
									timeStart: new Date().getTime()
								}

						// targeting
							const shuffledIds = CORE.sortRandom(Object.keys(game.players))
							for (let i = 0; i < shuffledIds.length; i++) {
								const thisPlayerId = shuffledIds[i]
								const targetPlayerId = shuffledIds[i + 1] ? shuffledIds[i + 1] : shuffledIds[0]
								query.document[`players.${thisPlayerId}.target`] = targetPlayerId
							}

						// update
							CORE.accessDatabase(query, results => {
								if (!results.success) {
									callback({success: false, message: `unable to start game`, recipients: [REQUEST.session.userId]})
									return
								}

								// game
									const updatedGame = results.documents[0]

								// inform others
									callback({success: true, message: `game started`, start: true, game: updatedGame, recipients: Object.keys(updatedGame.players)})
							})
					})
			}
			catch (error) {
				CORE.logError(error)
				callback({success: false, message: `unable to ${arguments.callee.name}`, recipients: [REQUEST.session.userId]})
			}
		}

	/* capturePlayer */
		module.exports.capturePlayer = capturePlayer
		function capturePlayer(REQUEST, callback) {
			try {
				// no playerId
					if (!REQUEST.post.playerId) {
						callback({success: false, message: `invalid player`, recipients: [REQUEST.session.userId]})
						return
					}

				// self
					if (REQUEST.post.playerId == REQUEST.session.userId) {
						callback({success: false, message: `cannot capture self`, recipients: [REQUEST.session.userId]})
						return
					}

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

						// game ended
							if (game.timeEnd) {
								callback({success: false, message: `game already ended`, recipients: [REQUEST.session.userId]})
								return
							}

						// self not in game
							if (!game.players[REQUEST.session.userId]) {
								callback({success: false, message: `not playing this game`, recipients: [REQUEST.session.userId]})
								return
							}

						// player not in game
							if (!game.players[REQUEST.post.playerId]) {
								callback({success: false, message: `player not in game`, recipients: [REQUEST.session.userId]})
								return
							}

						// players stunned
							const selfPlayer = game.players[REQUEST.session.userId]
							const opponentPlayer = game.players[REQUEST.post.playerId]

						// self stunned
							if (selfPlayer.cooldown) {
								callback({success: false, message: `still stunned`, recipients: [REQUEST.session.userId]})
								return
							}

						// opponent stunned
							if (opponentPlayer.cooldown) {
								callback({success: false, message: `player already stunned`, recipients: [REQUEST.session.userId]})
								return
							}

						// opponent out
							if (!opponentPlayer.target) {
								callback({success: false, message: `player already out`, recipients: [REQUEST.session.userId]})
								return
							}

						// not self's target
							if (selfPlayer.target && selfPlayer.target !== opponentPlayer.userId) {
								callback({success: false, message: `not your target`, recipients: [REQUEST.session.userId]})
								return
							}

						// retargeting
							const opponentTargeterId = Object.keys(game.players).find(playerId => {
								return game.players[playerId].target == opponentPlayer.userId
							}) || null

						// query
							const query = CORE.getSchema("query")
								query.collection = "games"
								query.command = "update"
								query.filters = {id: gameId}
								query.document = {
									updated: new Date().getTime(),
									[`players.${opponentPlayer.userId}.cooldown`]: CONSTANTS.stunCooldown,
									[`players.${opponentPlayer.userId}.stuns`]: opponentPlayer.stuns + 1,
									[`players.${opponentPlayer.userId}.target`]: null,
									[`players.${selfPlayer.userId}.shots`]: selfPlayer.shots + 1,
									[`players.${selfPlayer.userId}.target`]: opponentPlayer.target
								}
								if (opponentTargeterId) {
									query.document[`players.${opponentTargeterId}.target`] = selfPlayer.userId
								}

						// update
							CORE.accessDatabase(query, results => {
								if (!results.success) {
									callback({success: false, message: `unable to capture player`, recipients: [REQUEST.session.userId]})
									return
								}

								// game
									const updatedGame = results.documents[0]

								// inform others
									callback({success: true, message: `${selfPlayer.name} shot ${opponentPlayer.name}`, game: updatedGame, recipients: Object.keys(updatedGame.players)})
							})
					})
			}
			catch (error) {
				CORE.logError(error)
				callback({success: false, message: `unable to ${arguments.callee.name}`, recipients: [REQUEST.session.userId]})
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
