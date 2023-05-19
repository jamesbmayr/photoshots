/*** modules ***/
	const CORE = require("../node/core")
	const SESSION = require("../node/session")
	module.exports = {}

/*** constants ***/
	const CONSTANTS = CORE.getAsset("constants")

/*** REQUEST ***/
	/* createOne */
		module.exports.createOne = createOne
		function createOne(REQUEST, callback) {
			try {
				// validate
					if (!REQUEST.post.name || !CONSTANTS.userNameRegex.test(REQUEST.post.name.trim())) {
						callback({success: false, message: `name must be 8 - 16 numbers, letters, and underscores`})
						return
					}
					if (!REQUEST.post.password || !REQUEST.post.password.trim().length || !CONSTANTS.passwordRegex.test(REQUEST.post.password)) {
						callback({success: false, message: `password must be 8 - 64 characters`})
						return
					}

				// query
					const query = CORE.getSchema("query")
						query.collection = "users"
						query.command = "find"
						query.filters = {name: REQUEST.post.name.trim().toLowerCase()}

				// find
					CORE.accessDatabase(query, results => {
						if (results.success && results.count) {
							callback({success: false, message: `name in use`})
							return
						}

						// new user
							const user = CORE.getSchema("user")
								user.name = REQUEST.post.name.trim()
							const {hash, salt} = CORE.hashRandom(REQUEST.post.password)
								user.secret.salt = salt
								user.secret.hash = hash

						// query
							const query = CORE.getSchema("query")
								query.collection = "users"
								query.command = "insert"
								query.document = user

						// insert
							CORE.accessDatabase(query, results => {
								if (!results.success) {
									callback({success: false, message: `unable to create user`})
									return
								}

								// user
									const userId = results.documents[0].id
									const username = results.documents[0].name

								// update session
									SESSION.setUser(REQUEST.session.id, userId, results => {
										if (!results.success) {
											callback(results)
											return
										}

										callback({success: true, location: `/user/${username}`})
									})
							})
					})
			}
			catch (error) {
				CORE.logError(error)
				callback({success: false, message: `unable to ${arguments.callee.name}`})
			}
		}

	/* loginOne */
		module.exports.loginOne = loginOne
		function loginOne(REQUEST, callback) {
			try {
				// validate
					if (!REQUEST.post.name || !CONSTANTS.userNameRegex.test(REQUEST.post.name.trim())) {
						callback({success: false, message: `name must be 8 - 16 numbers, letters, and underscores`})
						return
					}
					if (!REQUEST.post.password || !REQUEST.post.password.trim().length || !CONSTANTS.passwordRegex.test(REQUEST.post.password)) {
						callback({success: false, message: `password must be 8 - 64 characters`})
						return
					}

				// query
					const query = CORE.getSchema("query")
						query.collection = "users"
						query.command = "find"
						query.filters = {name: REQUEST.post.name.trim().toLowerCase()}

				// find
					CORE.accessDatabase(query, results => {
						if (!results.success) {
							callback({success: false, message: `unable to find user`})
							return
						}

						// no previous password
							const user = results.documents[0]
							if (!user.secret || !user.secret.hash) {
								callback({success: false, message: `incorrect password`})
								return
							}

						// authenticate old password
							const {hash, salt} = CORE.hashRandom(REQUEST.post.password, user.secret.salt)
							if (hash !== user.secret.hash || salt !== user.secret.salt) {
								callback({success: false, message: `incorrect password`})
								return
							}

						// user
							const userId = results.documents[0].id
							const username = results.documents[0].name

						// update session
							SESSION.setUser(REQUEST.session.id, userId, results => {
								if (!results.success) {
									callback(results)
									return
								}

								callback({success: true, location: `/user/${username}`})
							})
					})
			}
			catch (error) {
				CORE.logError(error)
				callback({success: false, message: `unable to ${arguments.callee.name}`})
			}
		}

	/* logoutOne */
		module.exports.logoutOne = logoutOne
		function logoutOne(REQUEST, callback) {
			try {
				// validate
					if (!REQUEST.session.userId) {
						callback({success: false, message: `not logged in`})
						return
					}

				// query
					const query = CORE.getSchema("query")
						query.collection = "users"
						query.command = "find"
						query.filters = {id: REQUEST.session.userId}

				// find
					CORE.accessDatabase(query, results => {
						if (!results.success) {
							callback({success: false, message: `unable to find user`})
							return
						}

						// user
							const user = results.documents[0]

						// in a game
							if (user.gameId) {
								callback({success: false, message: `leave game ${user.gameId} to log out`})
								return
							}

						// update session
							SESSION.setUser(REQUEST.session.id, null, results => {
								if (!results.success) {
									callback(results)
									return
								}

								callback({success: true, location: `/`})
							})
					})
			}
			catch (error) {
				CORE.logError(error)
				callback({success: false, message: `unable to ${arguments.callee.name}`})
			}
		}

	/* updateName */
		module.exports.updateName = updateName
		function updateName(REQUEST, callback) {
			try {
				// authenticated?
					if (!REQUEST.session.userId) {
						callback({success: false, message: `not logged in`})
						return
					}

				// validate
					if (!REQUEST.post.name || !CONSTANTS.userNameRegex.test(REQUEST.post.name.trim())) {
						callback({success: false, message: `name must be 8 - 16 numbers, letters, and underscores`})
						return
					}

				// query
					const query = CORE.getSchema("query")
						query.collection = "users"
						query.command = "find"
						query.filters = {name: REQUEST.post.name.trim().toLowerCase()}

				// find
					CORE.accessDatabase(query, results => {
						if (results.success && results.count && results.documents[0].id !== REQUEST.session.userId) {
							callback({success: false, message: `name in use`})
							return
						}

						// query
							const query = CORE.getSchema("query")
								query.collection = "users"
								query.command = "update"
								query.filters = {id: REQUEST.session.userId}
								query.document = {
									updated: new Date().getTime(),
									name: REQUEST.post.name.trim()
								}

						// update
							CORE.accessDatabase(query, results => {
								if (!results.success) {
									callback({success: false, message: `unable to update name`})
									return
								}

								// user
									const user = results.documents[0]
									delete user.secret

								// respond
									callback({success: true, message: `name updated to ${user.name}`, location: `/user/${user.name}`})
							})
					})
			}
			catch (error) {
				CORE.logError(error)
				callback({success: false, message: `unable to ${arguments.callee.name}`})
			}
		}

	/* updatePassword */
		module.exports.updatePassword = updatePassword
		function updatePassword(REQUEST, callback) {
			try {
				// authenticated?
					if (!REQUEST.session.userId) {
						callback({success: false, message: `not logged in`})
						return
					}

				// validate
					if (!REQUEST.post.oldPassword || !REQUEST.post.oldPassword.trim().length || !CONSTANTS.passwordRegex.test(REQUEST.post.oldPassword)) {
						callback({success: false, message: `previous password must be 8 - 64 characters`})
						return
					}
					if (!REQUEST.post.newPassword || !REQUEST.post.newPassword.trim().length || !CONSTANTS.passwordRegex.test(REQUEST.post.newPassword)) {
						callback({success: false, message: `new password must be 8 - 64 characters`})
						return
					}

				// password
					const oldPassword = REQUEST.post.oldPassword
					const newPassword = REQUEST.post.newPassword

				// query
					const query = CORE.getSchema("query")
						query.collection = "users"
						query.command = "find"
						query.filters = {id: REQUEST.session.userId}

				// find
					CORE.accessDatabase(query, results => {
						if (!results.success) {
							callback({success: false, message: `unable to find user`})
							return
						}

						// no previous password
							const user = results.documents[0]
							if (!user.secret || !user.secret.hash) {
								callback({success: false, message: `incorrect password`})
								return
							}

						// authenticate old password
							const oldHashAndSalt = CORE.hashRandom(oldPassword, user.secret.salt)
							if (oldHashAndSalt.hash !== user.secret.hash || oldHashAndSalt.salt !== user.secret.salt) {
								callback({success: false, message: `incorrect password`})
								return
							}

						// hash new password
							const {hash, salt} = CORE.hashRandom(newPassword)

						// query
							const query = CORE.getSchema("query")
								query.collection = "users"
								query.command = "update"
								query.filters = {id: user.id}
								query.document = {
									updated: new Date().getTime(),
									"secret.salt": salt,
									"secret.hash": hash
								}

						// update
							CORE.accessDatabase(query, results => {
								if (!results.success) {
									callback({success: false, message: `unable to update password`})
									return
								}

								// respond
									callback({success: true, message: `password updated`})
							})
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

				// authenticated?
					if (!REQUEST.session.userId) {
						callback({success: false, message: `not logged in`})
						return
					}

				// validate
					if (!REQUEST.post.password || !REQUEST.post.password.trim().length || !CONSTANTS.passwordRegex.test(REQUEST.post.password)) {
						callback({success: false, message: `password must be 8 - 64 characters`})
						return
					}

				// query
					const query = CORE.getSchema("query")
						query.collection = "users"
						query.command = "find"
						query.filters = {id: REQUEST.session.userId}

				// find
					CORE.accessDatabase(query, results => {
						if (!results.success) {
							callback({success: false, message: `unable to find user`})
							return
						}

						// no password
							const user = results.documents[0]
							if (!user.secret || !user.secret.hash) {
								callback({success: false, message: `incorrect password`})
								return
							}

						// authenticate password
							const {hash, salt} = CORE.hashRandom(REQUEST.post.password, user.secret.salt)
							if (hash !== user.secret.hash || salt !== user.secret.salt) {
								callback({success: false, message: `incorrect password`})
								return
							}

						// in a game
							if (user.gameId) {
								callback({success: false, message: `leave game ${user.gameId} to log out`})
								return
							}

						// query
							const query = CORE.getSchema("query")
								query.collection = "users"
								query.command = "delete"
								query.filters = {id: user.id} 

						// delete
							CORE.accessDatabase(query, results => {
								if (!results.success) {
									callback({success: false, message: `unable to delete user`})
									return
								}

								// update session
									SESSION.setUser(REQUEST.session.id, null, results => {
										if (!results.success) {
											callback(results)
											return
										}

										callback({success: true, location: `/`})
									})
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
		function readOne(userId, username, callback) {
			try {
				// validate
					if (!userId && !username) {
						callback({success: false, message: `no user info`})
						return
					}

					if (username && !CONSTANTS.userNameRegex.test(username)) {
						callback({success: false, message: `invalid user name`})
						return
					}

				// query
					const query = CORE.getSchema("query")
						query.collection = "users"
						query.command = "find"
						query.filters = userId ? {id: userId} : {name: username}

				// find
					CORE.accessDatabase(query, results => {
						if (!results.success) {
							callback({success: false, message: `user not found`})
							return
						}

						// user found
							const user = results.documents[0]
							delete user.secret

						// return data
							callback({success: true, user: user})
					})
			}
			catch (error) {
				CORE.logError(error)
				callback({success: false, message: `unable to ${arguments.callee.name}`})
			}
		}

	/* setGame */
		module.exports.setGame = setGame
		function setGame(userId, gameId, callback) {
			try {
				// validate
					if (!userId) {
						callback({success: false, message: `unable to set game for ${userId}`})
						return
					}

				// invalid gameId
					if (gameId && !CONSTANTS.gamePathRegex.test(`/game/${gameId}`)) {
						callback({success: false, message: `invalid game id`})
						return
					}

				// query
					const query = CORE.getSchema("query")
						query.collection = "users"
						query.command = "update"
						query.filters = {id: userId}
						query.document = {
							updated: new Date().getTime(),
							gameId: gameId
						}

				// update
					CORE.accessDatabase(query, results => {
						if (!results.success) {
							callback({success: false, message: `unable to update game id`})
							return
						}

						// update session
							SESSION.setGame(userId, gameId, results => {
								if (!results.success) {
									callback({success: false, message: `unable to set game id`})
									return
								}

								callback({success: true})
							})
					})
			}
			catch (error) {
				CORE.logError(error)
				callback({success: false, message: `unable to ${arguments.callee.name}`})
			}
		}
