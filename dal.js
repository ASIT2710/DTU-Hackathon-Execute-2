const {ddbDocClient, cache} = require('./clients');
const {randomUUID} = require("crypto");
const constants = require('./constants');
const {writeToDb, generateUniqueId, sendSms, generateOtp, constructCacheKeyForOtp} = require('./utils');

const getAccountIdMapping = async (phone) => {
    console.log(`gettingAccountIdMapping for ${phone}, tbl: ${constants.userAccountIdMappingTable}`);
    const data = await ddbDocClient.get({
        TableName: constants.userAccountIdMappingTable,
        Key: { phone }
    }).promise()
    console.log(`accountIdMapping for ${phone} query result: ${JSON.stringify(data)}`);
    if ('Item' in data) {
        return data['Item'];
    }
    console.log(`accountIdMapping not found for phone ${phone}`);
    return null;
}

const deactivateUserAccount = async (oldId) => {
    await ddbDocClient.update({
        TableName: constants.accountTable,
        Key: {'id': oldId},
        UpdateExpression: "set currentActive = :currentActive",
        ExpressionAttributeValues: {
            ':currentActive': false
        },
    }).promise()
}

const getUserAccount = async (id) => {
    const res = await ddbDocClient.get({
        TableName: constants.accountTable,
        Key: {id},
    }).promise();
    if ('Item' in res) {
        return res['Item'];
    }
    return null;
}

const getUserAccountByPhone = async (phone) => {
    const mapping = await ddbDocClient.get({
        TableName: constants.userAccountIdMappingTable,
        Key: { phone }
    }).promise()
    if (mapping && 'Item' in mapping) {
        return await getUserAccount(mapping.Item.id);
    }
    return null
}

const isDebitPossible = async (phone, howMuch) => {
    let result = false;
    const account = await getUserAccountByPhone(phone);
    if (account) {
        if ('balance' in account) {
            if (account.balance >= parseInt(howMuch, 10)) {
                result = true;
            }
        }
    }
    return result;
}

const addNewUserAccountRecord = async (data) => {
    await ddbDocClient.put({
        TableName: constants.accountTable,
        Item: {...data, 'currentActive': true, createdAt: Date.now()},
    }).promise();
}

const updateUserAccountIdMapping = async (phone, newId) => {
    await ddbDocClient.update({
        TableName: constants.userAccountIdMappingTable,
        Key: { 'phone': phone },
        UpdateExpression: 'set id = :id',
        ExpressionAttributeValues: {
            ':id': newId
        }
    }).promise()
}

const addNewUserAccountIdMapping = async (phone, newId) => {
    await ddbDocClient.put({
        TableName: constants.userAccountIdMappingTable,
        Item: {
            'phone': phone,
            'id': newId
        }
    }).promise()
}

const getTxn = async (txnId) => {
    console.log(`getTxn: ${txnId}`)
    const res = await ddbDocClient.get({
        TableName: constants.txnTable,
        Key: {txnId}
    }).promise()
    console.log(`getTxn for ${txnId}: ${JSON.stringify(res)}`);
    if ('Item' in res) {
        return res['Item']
    }
    return null
}


const addNewTxn = async (Item) => {
    await writeToDb(constants.txnTable, Item);
}

// searches for 1 account
const findHumanForDeposit = async (requesterPhone, howMuch, location) => {
    const params = {
        TableName: constants.accountTable,
        FilterExpression: "balance >= :balance AND loc = :loc AND phone <> :phone AND currentActive = :currentActive",
        ExpressionAttributeValues: {
            ":balance": parseInt(howMuch, 10),
            ":loc": location,
            ":phone": requesterPhone,
            ":currentActive": true
        }
    }
    let res = await ddbDocClient.scan(params).promise()
    let account = null;
    if (res.Items.length === 0 && res.LastEvaluatedKey && 'id' in res.LastEvaluatedKey) {
        while (res.Items.length === 0 && res.LastEvaluatedKey && 'id' in res.LastEvaluatedKey) {
            res = await ddbDocClient.scan({...params, ExclusiveStartKey: res.LastEvaluatedKey}).promise()
            if (res.Items.length > 0) {
                account = res.Items[0];
            }
            if (!res.LastEvaluatedKey || !('id' in res.LastEvaluatedKey)) {
                break
            }
        }
    } else {
        account = res.Items[0];
    }
    return account;
}

// searches for 1 account
const findHumanAtLocation = async (requesterPhone, location) => {
    const params = {
        TableName: constants.accountTable,
        FilterExpression: "loc = :loc AND phone <> :phone AND currentActive = :currentActive",
        ExpressionAttributeValues: {
            ":loc": location,
            ":phone": requesterPhone,
            ":currentActive": true
        }
    }
    let res = await ddbDocClient.scan(params).promise()
    let account;
    if (res.Items.length === 0 && res.LastEvaluatedKey && 'id' in res.LastEvaluatedKey) {
        while (res.Items.length === 0 && res.LastEvaluatedKey && 'id' in res.LastEvaluatedKey) {
            res = await ddbDocClient.scan({...params, ExclusiveStartKey: res.LastEvaluatedKey}).promise()
            if (res.Items.length > 0) {
                account = res.Items[0];
            }
            if (!res.LastEvaluatedKey || !('id' in res.LastEvaluatedKey)) {
                break
            }
        }
    } else {
        account = res.Items[0];
    }
    return account;
}

const findFloatingRequest = async (phone) => {
    const res = await ddbDocClient.get({
        TableName: constants.floatingTable,
        Key: {phone}
    }).promise();
    if ('Item' in res) {
        return res['Item'];
    }
    return null;

}

const getUserRequestById = async (id) => {
    const res = await ddbDocClient.get({
        TableName: constants.requestTable,
        Key: { id }
    }).promise();
    if ('Item' in res) {
        return res['Item'];
    }
    return null;
}

const updateTxnStatusToSuccess = async (txnId) => {
    const txn = await getTxn(txnId)
    if (txn) {
        await ddbDocClient.update({
            TableName: constants.txnTable,
            Key: {txnId},
            UpdateExpression: "set #txnStatus = :status",
            ExpressionAttributeValues: {
                ':status': constants.txnStatus.success
            },
            ExpressionAttributeNames: {
                '#txnStatus': 'status'
            }
        }).promise()
        console.log(`txn ${txnId} status updated to success`)
    }
}

const isTxnIdUniq = async (id) => {
    const txn = await getTxn(id);
    console.log(`checking txn uniq, txn: ${JSON.stringify(txn)}`);
    return txn === null || !('txnId' in txn);
}

const createTxn = async (firstParty,
                         secondParty,
                         requestType,
                         howMuch,
                         sendTxnIdTo,
                         sendOtpTo) => {

    // create new txn & save in db
    const txnId = await generateUniqueId(constants.txnUidSize, isTxnIdUniq)
    await addNewTxn({
        'txnId': txnId,
        'firstParty': firstParty,
        'secondParty': secondParty,
        'requestType': requestType,
        'money': parseInt(howMuch, 10),
        'status': constants.txnStatus.created,
        'createdAt': Date.now(),
        'currentActive':  true,
    });
    console.log(`created new txn ${txnId} between ${firstParty} & ${secondParty} for ${howMuch} type ${requestType}`)
    // send txn id to
    await sendSms(sendTxnIdTo.toPhoneNumber(), txnId)
    // generate otp
    const otp = generateOtp()
    console.log(`otp generated: ${otp}`);
    const key = constructCacheKeyForOtp(txnId)
    // save otp in cache
    await cache.set(key, otp, {EX: constants.otpExpiryInSeconds});
    console.log(`otp ${otp} cache set for key ${key} `);
    // send otp to
    await sendSms(sendOtpTo.toPhoneNumber(), otp)
}

const addLedgerEntry = async (whose, note, money, op, opening) => {
    const entry = {
        id: randomUUID(),
        'phone': whose,
        'op': op,
        'note': note,
        'money': money,
        'openingBalance': opening,
        'createdAt': Date.now()
    }
    await writeToDb(constants.ledgerTable, entry);
    console.log(`ledger entry added: ${JSON.stringify(entry)}`);
}

const getBucket = async (phoneWithBucketName) => {
    const res = await ddbDocClient.get({
        TableName: constants.bucketTable,
        Key: { phoneWithBucketName }
    }).promise()
    if ('Item' in res) {
        return res['Item'];
    }
    return null;
}

const getBucketBalance = async (phone, bucketName) => {
    const res = await getBucket(constructUserBucketKey(phone, bucketName));
    if (res && 'balance' in res) {
        return res.balance;
    }
    return null;
}

const constructUserBucketKey = (phone, bucketName) => `${phone.toPhoneNumberDbKey()}:${bucketName}`;

const updateBucket = async (phone, bucketName, howMuch) => {
    const existing = await getBucket(constructUserBucketKey(phone, bucketName))
    await writeToDb(constants.bucketTable, {
        phoneWithBucketName: constructUserBucketKey(phone, bucketName),
        balance: existing ? parseInt(existing.balance) + parseInt(howMuch) : parseInt(howMuch)
    });
};

const getCachedOtpForTxn = async (txnId) => {
    const key = constructCacheKeyForOtp(txnId);
    return await cache.get(key)
}

const getCreditHistory = async (creditorPhone, debtorPhone) => {
    const res = await ddbDocClient.get({
        TableName: constants.creditHistoryTable,
        Key: { 'creditorPhone:debtorPhone': `${creditorPhone}:${debtorPhone}` }
    }).promise();
    if ('Item' in res) {
        return res['Item'];
    }
    return null;
}

const updateKhata = async (creditorPhone, debtorPhone, money, op, note, openingBalance) => {
    await ddbDocClient.put({
        TableName: constants.khataTable,
        Item: {
            id: randomUUID(),
            creditorPhone,
            debtorPhone,
            money,
            op,
            note,
            openingBalance,
            createdAt: Date.now(),
        }
    }).promise();
}

const getCreditBalance = async (creditorPhone) => {
    const res = await ddbDocClient.get({
        TableName: constants.creditTotalTable,
        Key: { 'creditorPhone': creditorPhone }
    }).promise();
    if ('Item' in res) {
        return res['Item'];
    }
    return null;
}

const addToCreditBalance = async (creditorPhone, amount) => {
    const opening = await getCreditBalance(creditorPhone);
    await ddbDocClient.put({
        TableName: constants.creditTotalTable,
        Item: {
            ...opening,
            balance: ((opening === null) ? 0 : opening.balance) + amount
        }
    }).promise()
}

const registerCredit = async (creditorPhone, debtorPhone, amount, period) => {
    const opening = getCreditHistory(creditorPhone, debtorPhone);
    let balance = 0;
    if (opening === null) {
        // register first
        balance = amount;
    } else {
        // increment amount
        balance = amount + opening.balance;
    }
    await ddbDocClient.put({
        TableName: constants.creditHistoryTable,
        Item: {
            'creditorPhone:debtorPhone': `${creditorPhone}:${debtorPhone}`,
            balance,
        }
    }).promise();
    await addToCreditBalance(creditorPhone, amount);
    await updateKhata(
        creditorPhone,
        debtorPhone,
        amount,
        "credit",
        "credit lended",
        opening ? opening.balance : 0
    )
}

const getDebtBalance = async (debtorPhone) => {
    const res = await ddbDocClient.get({
        TableName: constants.debtTotalTable,
        Key: { 'debtorPhone': debtorPhone }
    }).promise();
    if ('Item' in res) {
        return res['Item'];
    }
    return null;
}

const getDebtHistory = async (debtorPhone, creditorPhone) => {
    const res = await ddbDocClient.get({
        TableName: constants.debtHistoryTable,
        Key: { 'debtorPhone:creditorPhone': `${debtorPhone}:${creditorPhone}` }
    }).promise();
    if ('Item' in res) {
        return res['Item'];
    }
    return null;
}

const handleDebtCollected = async (amount, debtorPhone, creditorPhone) => {
    const opening = await getDebtHistory(debtorPhone, creditorPhone);
    await ddbDocClient.put({
        TableName: constants.debtHistoryTable,
        Item: {
            'debtorPhone:creditorPhone': `${debtorPhone}:${creditorPhone}`,
            balance: opening.balance - amount,
        }
    }).promise();
    const openingTotal = await getDebtBalance(debtorPhone);
    await ddbDocClient.put({
        TableName: constants.debtHistoryTable,
        Item: {
            'debtorPhone': debtorPhone,
            balance: openingTotal.balance - amount,
        }
    }).promise()
    await updateKhata(
        creditorPhone,
        debtorPhone,
        amount,
        "paid",
        "debt paid",
        opening ? opening.balance : 0
    );
}

module.exports = {
    getDebtHistory,
    getCreditHistory,
    handleDebtCollected,
    getDebtBalance,
    getCreditBalance,
    registerCredit,
    isDebitPossible,
    getCachedOtpForTxn,
    getBucketBalance,
    updateBucket,
    getBucket,
    getUserAccountByPhone,
    addLedgerEntry,
    createTxn,
    updateTxnStatusToSuccess,
    getUserRequestById,
    findFloatingRequest,
    findHumanAtLocation,
    findHumanForDeposit,
    getAccountIdMapping,
    deactivateUserAccount,
    getUserAccount,
    addNewUserAccountRecord,
    updateUserAccountIdMapping,
    getTxn,
    addNewTxn,
    addNewUserAccountIdMapping
}
