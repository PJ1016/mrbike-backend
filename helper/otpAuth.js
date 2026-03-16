// Verify OTP
const JWT_AUTH_TOKEN = process.env.JWT_AUTH_TOKEN || process.env.JWT_SECRET;
const JWT_REFRESH_TOKEN = process.env.JWT_REFRESH_TOKEN || process.env.JWT_SECRET;
let refreshTokens = [];

// Twilio
const sendotp = async(phone)=>{
     const otp = Math.floor(100000 + Math.random() * 900000);
	 const ttl = 2 * 60 * 1000;
	 const expires = Date.now() + ttl;
	 const data = `${phone}.${otp}.${expires}`;
	 const hash = crypto.createHmac('sha256', smsKey).update(data).digest('hex');
	 const fullHash = `${hash}.${expires}`;
     //console.log(otp);
     await client.messages.create({
	 		body: `Your One Time Login Password For CFM is ${otp}`,
	 		from: twilioNum,
	 		to: phone
	})
    return {phone, hash:fullHash}
    
    // const otp = Math.floor(100000 + Math.random() * 900000);
	// const ttl = 2 * 60 * 1000;
	// const expires = Date.now() + ttl;
	// const data = `${phone}.${otp}.${expires}`;
	// const hash = crypto.createHmac('sha256', smsKey).update(data).digest('hex');
	// const fullHash = `${hash}.${expires}`;
    // await client.messages.create({
	// 		body: `Your One Time Login Password For CFM is ${otp}`,
	// 		from: twilioNum,
	// 		to: phone
	// 	})
	// 	.then((messages) => {
    //         //res.status(200).json({success:true, message:messages})
    //         console.log(otp);
    //         // user.otp = otp;
    //         // user.save();
    //         // res.status(200).send({ phone, hash: fullHash,message:messages });
    //         res.status(200).send({ phone, hash: fullHash});
    //         return;
    //         })
    //         .catch(error => {
    //         res.status(400).json({success:false,error,message:"Mobile no is not verified with Twilio"})
    //         return;
    //     })
	// res.status(200).send({ phone, hash: fullHash, otp });  // this bypass otp via api only for development instead hitting twilio api all the time
	//res.status(200).send({ phone, hash: fullHash });       
}

// Twilio
const verifyotp = async(phone, hash, otp)=>{

	let [ hashValue, expires ] = hash.split('.');

    let now = Date.now();
	if (now > parseInt(expires)) {
		return { errors: 'Timeout. Please try again'};
	}
	let data = `${phone}.${otp}.${expires}`;
	let newCalculatedHash = crypto.createHmac('sha256', smsKey).update(data).digest('hex');
	if (newCalculatedHash === hashValue) {
		console.log('user confirmed');
		const accessToken = jwt.sign({ data: phone }, JWT_AUTH_TOKEN, { expiresIn: '30s' });
		const refreshToken = jwt.sign({ data: phone }, JWT_REFRESH_TOKEN, { expiresIn: '1y' });
		refreshTokens.push(refreshToken);
		return {accessToken, refreshToken}
	} else {
		console.log('not authenticated ...... Incorrect OTP');
}
}


// Bulk SMS
const otp = async(phone)=>{
	
    const otp = Math.floor(1000 + Math.random() * 9000);
	const accessToken = jwt.sign({ data: phone }, JWT_AUTH_TOKEN, { expiresIn: '60s' });
	const refreshToken = jwt.sign({ data: phone }, JWT_REFRESH_TOKEN, { expiresIn: '1y' });
	refreshTokens.push(refreshToken);
	
    //console.log(otp);
	// fetch(`http://sendsms.designhost.in/index.php/smsapi/httpapi/?uname=citygarage&password=Pass123$$&sender=CETYGR&tempid=1707164871113048733&receiver=${phone}&route=TA&msgtype=1&sms=OTP For Your mobile verification is ${otp}. Team Mr. Bike Doctor CITY GARAGE PRIVATE LIMITED`)
	fetch(`http://sms.designhost.in/api/mt/SendSMS?user=citygarage&password=123456&senderid=CETYGR&channel=Trans&DCS=0&flashsms=0&number=${phone}&text=OTP For Your mobile verification is ${otp}. Team Mr. Bike Doctor CITY GARAGE PRIVATE LIMITED&route=1&peid=1701164086573753451&DLTTemplateId=1707164871113048733`)
    .then(res => res.text())
    .then(text => {
		console.log(text);
    });

	return { otp , msg :" OTP send to ur Mobile no", accessToken, refreshToken};
}


const pickndropotp = async(sphone,uphone,service_provider_address,user_address)=>{
    const otp = Math.floor(1000 + Math.random() * 9000);
	const accessToken = jwt.sign({ data: uphone }, JWT_AUTH_TOKEN, { expiresIn: '60s' });
	const refreshToken = jwt.sign({ data: uphone }, JWT_REFRESH_TOKEN, { expiresIn: '1y' });
	refreshTokens.push(refreshToken);
	
	fetch(`http://182.18.170.179/api.php?username=citygareage&password=228110&to=${sphone},${uphone}&from=GARAGC&message="OTP For Your mobile verification is ${otp}OTP service provider address - ${service_provider_address} service provider Contact no - ${sphone} customer address - ${user_address} Customer Contact no -${uphone}. Team Mr. Bike Doctor CITY GARAGE PRIVATE LIMITED"&PEID=1701164086573753451&templateid=1707164871113048734`)
    .then(res => res.text())
    .then(text => {
		console.log(text);
    });

	return { otp , msg :" OTP send to ur Mobile no", accessToken, refreshToken};
}
module.exports = {sendotp, verifyotp, otp, pickndropotp};


/*
async function verifyOTP(req, res) {
    try{
    const phone = "+91"+req.body.phone;
	const hash = req.body.hash;
	const otp = req.body.otp;
	let [ hashValue, expires ] = hash.split('.');

    const user = await User.findOne({phone:phone});
    if(!user){
        res.status(401).json({success:false, message:"This Mobile is not associated with any account"});
        return;
    }

	let now = Date.now();
	if (now > parseInt(expires)) {
		return res.status(504).send({ msg: 'Timeout. Please try again' });
	}
	let data = `${phone}.${otp}.${expires}`;
	let newCalculatedHash = crypto.createHmac('sha256', smsKey).update(data).digest('hex');
	if (newCalculatedHash === hashValue) {
		console.log('user confirmed');
		const accessToken = jwt.sign({ data: phone }, JWT_AUTH_TOKEN, { expiresIn: '30s' });
		const refreshToken = jwt.sign({ data: phone }, JWT_REFRESH_TOKEN, { expiresIn: '1y' });
		refreshTokens.push(refreshToken);
		res
			.status(202)
			.cookie('accessToken', accessToken, {
				expires: new Date(new Date().getTime() + 30 * 1000),
				sameSite: 'strict',
				httpOnly: true
			})
			.cookie('refreshToken', refreshToken, {
				expires: new Date(new Date().getTime() + 31557600000),
				sameSite: 'strict',
				httpOnly: true
			})
			.cookie('authSession', true, { expires: new Date(new Date().getTime() + 30 * 1000), sameSite: 'strict' })
			.cookie('refreshTokenID', true, {
				expires: new Date(new Date().getTime() + 31557600000),
				sameSite: 'strict'
			})
			.json({msg: 'User verified',user });
	} else {
		console.log('not authenticated');
		return res.status(400).send({ verification: false, msg: 'Incorrect OTP' });
	}
    } catch(error){
        res.status(500).json({
            success:false,
            message:error.message,
        })
    }
}



async function verifyOTP(req, res) {
    try{
    const phone = "+91"+ req.body.phone;
	const otp = Math.floor(100000 + Math.random() * 900000);
	const ttl = 2 * 60 * 1000;
	const expires = Date.now() + ttl;
	const data = `${phone}.${otp}.${expires}`;
	const hash = crypto.createHmac('sha256', smsKey).update(data).digest('hex');
	const fullHash = `${hash}.${expires}`;

	client.messages
		.create({
			body: `Your One Time Login Password For CFM is ${otp}`,
			from: twilioNum,
			to: phone
		})
		.then((messages) => 
            // console.log(messages)
            res.status(200).send({ phone, hash: fullHash })
        )
		.catch((err) => console.error(err))

	// res.status(200).send({ phone, hash: fullHash, otp });  // this bypass otp via api only for development instead hitting twilio api all the time
	res.status(200).send({ phone, hash: fullHash });     
         // Use t
    } catch(error){
        res.status(500).json({
            success:false,
            message:error.message,
        })
    }
}

//fetch(`http://182.18.170.179/api.php?username=malgudi&password=mfb@1234&to=${phone}&from=MFMBKT&message="Your Verification code ${otp}(OTP) - MFB runrate"&PEID=1501674230000016192&templateid=1507162271349010474`)

*/
