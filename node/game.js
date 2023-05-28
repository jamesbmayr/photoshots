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
								game.mode = CORE.duplicateObject(CONSTANTS.gameModes[gameModeId])
								game.mode.id = gameModeId

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

								// self
									const game = results.documents[0]
									callback({success: true, message: `${connected ? "connected" : "disconnected"}`, game: game, playerId: REQUEST.session.userId, recipients: [REQUEST.session.userId]})

								// others
									const otherPlayerIds = Object.keys(game.players).filter(playerId => playerId !== REQUEST.session.userId)
									callback({success: true, message: `${game.players[REQUEST.session.userId].name} ${connected ? "connected" : "disconnected"}`, game: game, recipients: otherPlayerIds})
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
							if (game.ownerId == REQUEST.session.userId) {
								const otherPlayerIds = Object.keys(game.players).filter(playerId => playerId !== REQUEST.session.userId)
								query.document.ownerId = otherPlayerIds ? otherPlayerIds[0] : null
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
									timeStart: new Date().getTime(),
									timeRemaining: CONSTANTS.gameSeconds
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
									callback({success: true, message: `game started`, game: updatedGame, recipients: Object.keys(updatedGame.players)})

								// game loop
									CORE.accessLoops({
										command: "set",
										loopFunction: updateGame,
										id: updatedGame.id,
										callbackFunction: callback,
										interval: CONSTANTS.gameLoopInterval
									})
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
								if (opponentTargeterId && opponentTargeterId !== selfPlayer.userId) {
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

	/* updateOne */
		module.exports.updateOne = updateOne
		function updateOne(gameId, callback) {
			try {
				// query
					const query = CORE.getSchema("query")
						query.collection = "games"
						query.command = "find"
						query.filters = {id: gameId}

				// find
					CORE.accessDatabase(query, results => {
						if (!results.success) {
							CORE.accessLoops({
								command: "clear",
								id: gameId
							})
							return
						}

						// game
							const game = results.documents[0]

						// already ended?
							if (game.timeEnd) {
								CORE.accessLoops({
									command: "clear",
									id: gameId
								})
								return
							}

						// time's up?
							if (endOne(game, callback)) {
								return
							}

						// early victory?
							if (winOne(game, callback)) {
								return
							}

						// query
							const query = CORE.getSchema("query")
								query.collection = "games"
								query.command = "update"
								query.filters = {id: gameId}
								query.document = {
									updated: new Date().getTime(),
									timeRemaining: game.timeRemaining - 1, // s
								}

						// players
							for (const player of game.players) {
								// disconnected
									if (!player.connected) {
										continue
									}

								// cooldown
									else if (player.cooldown) {
										query.document[`players.${player.userId}.cooldown`] = Math.max(0, player.cooldown - 1)
									}

								// in or out?
									else if (player.target) {
										query.document[`players.${player.userId}.timeIn`] = player.timeIn + 1
									}
									else {
										query.document[`players.${player.userId}.timeOut`] = player.timeOut + 1
									}
							}

						// update
							CORE.accessDatabase(query, results => {
								if (!results.success) {
									return
								}

								// updated game
									const updatedgame = results.documents[0]
									const message = CONSTANTS.gameMessages[`_${updatedGame.timeRemaining}`]

								// update players
									if (message) {
										callback({success: true, message: message, game: updatedGame, recipients: Object.keys(updatedGame.players)})
									}
									else {
										callback({success: true, game: updatedGame, recipients: Object.keys(updatedGame.players)})
									}


							})
					})
			}
			catch (error) {
				CORE.logError(error)
				callback({success: false, message: `unable to ${arguments.callee.name}`, recipients: [REQUEST.session.userId]})
			}
		}

	/* endOne */
		module.exports.endOne = endOne
		function endOne(game, callback) {
			try {
				// still time remaining
					if (game.timeRemaining > 0) {
						return false
					}

				// stop loop
					CORE.accessLoops({
						command: "clear",
						id: game.id
					})

				// determine scores
					const mostStat  = game.mode.endStats[0]
					const leastStat = game.mode.endStats[1] || null
					const playerScores = {}
					for (const player of game.players) {
						playerScores[player.userId] = player[mostStat] - (leastStat ? player[leastStat] : 0)
					}

				// determine winners
					const highestScore = Object.values(playerScores).sort().reverse()[0]
					const winners = Object.keys(playerScores).filter(playerId => playerScores[playerId] == highestScore)
					const losers = Object.keys(playerScores).filter(playerId => playerScores[playerId] !== highestScore)

				// query
					const query = CORE.getSchema("query")
						query.collection = "games"
						query.command = "update"
						query.filters = {id: game.id}
						query.document = {
							updated: new Date().getTime(),
							timeEnd: new Date().getTime(),
							timeRemaining: 0
						}

				// players
					for (const player of game.players) {
						query.document[`players.${player.userId}.cooldown`] = 0
						query.document[`players.${player.userId}.target`] = null

						if (winners.includes(player.userId)) {
							query.document[`players.${player.userId}.win`] = true
						}
						else if (losers.includes(player.userId)) {
							query.document[`players.${player.userId}.loss`] = true
						}
					}

				// update
					CORE.accessDatabase(query, results => {
						if (!results.success) {
							return
						}

						// send to players
							const updatedgame = results.documents[0]
							callback({success: true, message: `win for ${winners.join(" & ")}`, game: updatedGame, recipients: Object.keys(updatedGame.players)})

						// update users' game history (and remove from game)
							for (const player of updatedGame.players) {
								USER.recordGame(player.userId, updatedGame, results => {
									if (!results.success) {
										callback({success: false, message: results.message, recipients: [player.userId]})
									}
								})
							}
					})

				// don't continue updating game
					return true
			}
			catch (error) {
				CORE.logError(error)
				callback({success: false, message: `unable to ${arguments.callee.name}`, recipients: [REQUEST.session.userId]})
			}
		}

	/* winOne */
		module.exports.winOne = winOne
		function winOne(game, callback) {
			try {
				// winners & losers
					const winners = []
					const losers = []

				// victory conditions
					switch (game.mode.id) {
						// fifteen_minutes_of_fame
							case "fifteen_minutes_of_fame":
								return false
							break
						
						// last_one_standing
							case "last_one_standing":
								const playerInIds  = Object.keys(game.players).filter(playerId => game.players[playerId].target)
								if (playerInIds.length !== 1) {
									return false
								}

								winners.push(playerInIds[0])
								losers.push(Object.keys(game.players).filter(playerId => playerId !== playerInIds[0]))
							break

						// ten_minutes_in
							case "ten_minutes_in":
								const tenMinInId = Object.keys(game.players).find(playerId => {
									return (game.players[playerId].timeIn - game.players[playerId].timeOut > 10 * 60) // s
								}) || null
								if (!tenMinInId) {
									return false
								}

								winners.push(tenMinInId)
								losers.push(Object.keys(game.players).filter(playerId => playerId !== tenMinInId))
							break

						// straight_shooter
							case "straight_shooter":
								const shooterId = Object.keys(game.players).find(playerId => {
									return (game.players[playerId].shots - game.players[playerId].stuns > 8) // shots
								}) || null
								if (!shooterId) {
									return false
								}

								winners.push(shooterId)
								losers.push(Object.keys(game.players).filter(playerId => playerId !== shooterId))
							break

						// one_stun_done
							case "one_stun_done":
								const unstunnedIds = Object.keys(game.playres).filter(playerId => !game.players[playerId].stuns)
								if (unstunnedIds !== 1) {
									return false
								}

								winners.push(unstunnedIds[0])
								losers.push(Object.keys(game.players).filter(playerId => playerId !== unstunnedIds[0]))
							break

						// invalid
							default:
								return false
							break
					}

				// stop loop
					CORE.accessLoops({
						command: "clear",
						id: game.id
					})

				// query
					const query = CORE.getSchema("query")
						query.collection = "games"
						query.command = "update"
						query.filters = {id: game.id}
						query.document = {
							updated: new Date().getTime(),
							timeEnd: new Date().getTime(),
							timeRemaining: 0
						}

				// players
					for (const player of game.players) {
						query.document[`players.${player.userId}.cooldown`] = 0
						query.document[`players.${player.userId}.target`] = null

						if (winners.includes(player.userId)) {
							query.document[`players.${player.userId}.win`] = true
						}
						else if (losers.includes(player.userId)) {
							query.document[`players.${player.userId}.loss`] = true
						}
					}

				// update
					CORE.accessDatabase(query, results => {
						if (!results.success) {
							return
						}

						// send to players
							const updatedgame = results.documents[0]
							callback({success: true, message: `win for ${winners.join(" & ")}`, game: updatedGame, recipients: Object.keys(updatedGame.players)})

						// update users' game history (and remove from game)
							for (const player of updatedGame.players) {
								USER.recordGame(player.userId, updatedGame, results => {
									if (!results.success) {
										callback({success: false, message: results.message, recipients: [player.userId]})
									}
								})
							}
					})

				// don't continue updating game
					return true
			}
			catch (error) {
				CORE.logError(error)
				callback({success: false, message: `unable to ${arguments.callee.name}`, recipients: [REQUEST.session.userId]})
			}
		}
