/*** globals ***/
	/* triggers */
		const TRIGGERS = {
			submit: "submit",
			click: "click"
		}

	/* elements */
		const ELEMENTS = {
			"login-username-input": document.querySelector("#login-username-input"),
			"login-password-input": document.querySelector("#login-password-input"),
			"login-user-button": document.querySelector("#login-user-button"),
			"create-user-button": document.querySelector("#create-user-button"),

			"logout-user-button": document.querySelector("#logout-user-button"),
			"join-camera-button": document.querySelector("#join-camera-button"),
			"join-gameid-input": document.querySelector("#join-gameid-input"),
			"join-game-button": document.querySelector("#join-game-button"),
			"create-game-button": document.querySelector("#create-game-button")
		}

/*** helpers ***/
	/* showToast */
		const TOAST = {
			beforeFade: 200, // ms
			afterFade: 5000, // ms
			element: null,
			timeout: null
		}

		function showToast(data) {
			try {
				// clear existing countdowns
					if (TOAST.timeout) {
						clearTimeout(TOAST.timeout)
						TOAST.timeout = null
					}

				// append
					if (!TOAST.element) {
						TOAST.element = document.createElement("div")
						TOAST.element.id = "toast"
						TOAST.element.setAttribute("visibility", false)
						TOAST.element.setAttribute("success", false)
						document.body.appendChild(TOAST.element)
					}

				// show
					setTimeout(() => {
						TOAST.element.innerHTML = data.message
						TOAST.element.setAttribute("success", data.success || false)
						TOAST.element.setAttribute("visibility", true)
					}, TOAST.beforeFade)

				// hide
					TOAST.timeout = setTimeout(() => {
						TOAST.element.setAttribute("visibility", false)
					}, TOAST.afterFade)
			} catch (error) {console.log(error)}
		}

	/* sendPost */
		function sendPost(options, callback) {
			try {
				// send data to server
					fetch(location.pathname, {method: "POST", body: JSON.stringify(options)})
						.then(function(response){ return response.json() })
						.then(function(data) {
							callback(data || {success: false, message: "unknown error"})
						})
						.catch(function(error) {
							callback({success: false, message: error})
						})
			} catch (error) {console.log(error)}
		}

	/* receivePost */
		function receivePost(data) {
			try {
				// redirect
					if (data.location) {
						window.location = data.location
						return
					}

				// message
					if (data.message) {
						showToast(data)
					}
			} catch (error) {console.log(error)}
		}

/*** logged out ***/
	/* createUser */
		if (ELEMENTS["create-user-button"]) {
			ELEMENTS["create-user-button"].addEventListener(TRIGGERS.click, submitCreateUser)
		}
		function submitCreateUser(event) {
			try {
				// get username
					const username = ELEMENTS["login-username-input"] ? ELEMENTS["login-username-input"].value.trim() : null
					if (!username || !username.length) {
						showToast({success: false, message: "enter a username"})
					}

				// get password
					const password = ELEMENTS["login-password-input"] ? ELEMENTS["login-password-input"].value.trim() : null
					if (!password || !password.length) {
						showToast({success: false, message: "enter a password"})
					}

				// send to server
					sendPost({
						action: "createUser",
						name: username,
						password: password
					}, receivePost)
			} catch (error) {console.log(error)}
		}

	/* loginUser */
		if (ELEMENTS["login-user-button"]) {
			ELEMENTS["login-user-button"].addEventListener(TRIGGERS.click, submitLoginUser)
		}
		function submitLoginUser(event) {
			try {
				// get username
					const username = ELEMENTS["login-username-input"] ? ELEMENTS["login-username-input"].value.trim() : null
					if (!username || !username.length) {
						showToast({success: false, message: "enter a username"})
					}

				// get password
					const password = ELEMENTS["login-password-input"] ? ELEMENTS["login-password-input"].value.trim() : null
					if (!password || !password.length) {
						showToast({success: false, message: "enter a password"})
					}

				// send to server
					sendPost({
						action: "loginUser",
						name: username,
						password: password
					}, receivePost)
			} catch (error) {console.log(error)}
		}

/*** logged in ***/
	/* logoutUser */
		if (ELEMENTS["logout-user-button"]) {
			ELEMENTS["logout-user-button"].addEventListener(TRIGGERS.click, submitLogoutUser)
		}
		function submitLogoutUser(event) {
			try {
				// send to server
					sendPost({
						action: "logoutUser"
					}, receivePost)
			} catch (error) {console.log(error)}
		}

	/* createGame */
		if (ELEMENTS["create-game-button"]) {
			ELEMENTS["create-game-button"].addEventListener(TRIGGERS.click, submitCreateGame)
		}
		function submitCreateGame(event) {
			try {
				// send to server
					sendPost({
						action: "createGame"
					}, receivePost)
			} catch (error) {console.log(error)}
		}

	/* joinGame */
		if (ELEMENTS["join-game-button"]) {
			ELEMENTS["join-game-button"].addEventListener(TRIGGERS.click, submitJoinGame)
		}
		function submitJoinGame(event) {
			try {
				// get gameid
					const gameId = ELEMENTS["login-gameid-input"] ? ELEMENTS["login-gameid-input"].value.trim() : null
					if (!gameId || !gameId.length) {
						showToast({success: false, message: "enter a game id"})
					}

				// send to server
					sendPost({
						action: "joinGame",
						gameId: gameId
					}, receivePost)
			} catch (error) {console.log(error)}
		}
