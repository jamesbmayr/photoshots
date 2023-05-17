/*** modules ***/
	const CORE = require("../node/core")
	const SESSION = require("../node/session")
	module.exports = {}

/*** constants ***/
	const CONSTANTS = CORE.getAsset("constants")

/*** creates ***/
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

								// update session
									const userId = results.documents[0].id
									const username = results.documents[0].name
									REQUEST.updateSession = {userId}
									SESSION.updateOne(REQUEST, null, () => {
										callback({success: true, location: `/user/${username}`})
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

/*** authenticates ***/
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

						// update session
							const userId = results.documents[0].id
							const username = results.documents[0].name
							REQUEST.updateSession = {userId}
							SESSION.updateOne(REQUEST, null, () => {
								callback({success: true, location: `/user/${username}`})
								return
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

						// update session
							REQUEST.updateSession = {userId: null, gameId: null}
							SESSION.updateOne(REQUEST, null, () => {
								callback({success: true, location: `/`})
								return
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
					if (!REQUEST.post.username || !CONSTANTS.userNameRegex.test(REQUEST.post.username)) {
						callback({success: false, message: `invalid user name`})
						return
					}

				// query
					const query = CORE.getSchema("query")
						query.collection = "users"
						query.command = "find"
						query.filters = {name: REQUEST.post.username}

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

				// action
					switch (REQUEST.post.action) {
						case "updateUserName":
							updateName(REQUEST, callback)
						break
						case "updateUserPassword":
							updatePassword(REQUEST, callback)
						break
						default:
							callback({success: false, message: `unknown user update operation`})
						break
					}
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
									return
							})
					})
			}
			catch (error) {
				CORE.logError(error)
				callback({success: false, message: `unable to ${arguments.callee.name}`})
			}
		}

/*** deletes ***/
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

						// authenticate old password
							const {hash, salt} = CORE.hashRandom(REQUEST.post.password, user.secret.salt)
							if (hash !== user.secret.hash || salt !== user.secret.salt) {
								callback({success: false, message: `incorrect password`})
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
									REQUEST.updateSession = {userId: null, gameId: null}
									SESSION.updateOne(REQUEST, null, () => {
										callback({success: true, location: `/`})
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
