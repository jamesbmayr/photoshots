/*** globals ***/
	/* triggers */
		const TRIGGERS = {
			submit: "submit",
			click: "click"
		}

	/* elements */
		const ELEMENTS = {
			"logout-user-button": document.querySelector("#logout-user-button"),
			"login-username-input": document.querySelector("#login-username-input"),
			"login-password-input": document.querySelector("#login-password-input"),
			"login-user-button": document.querySelector("#login-user-button"),
			"create-user-button": document.querySelector("#create-user-button"),
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
		ELEMENTS["create-user-button"]?.addEventListener(TRIGGERS.click, submitCreateUser)
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
		ELEMENTS["login-user-button"]?.addEventListener(TRIGGERS.click, submitLoginUser)
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
		ELEMENTS["logout-user-button"]?.addEventListener(TRIGGERS.click, submitLogoutUser)
		function submitLogoutUser(event) {
			try {
				// send to server
					sendPost({
						action: "logoutUser"
					}, receivePost)
			} catch (error) {console.log(error)}
		}
