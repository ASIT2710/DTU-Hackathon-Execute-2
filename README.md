# Rainbow bank
An offline & mobile first neo-bank for business owners.

Built for: DTU-Hackathon-Execute-2

## Db schema
- table: `khata`
```
id (pk)
creditorPhone
debtorPhone
money
op (credit, paid)
note
openingBalance
createdAt
```

- table: `creditHistory`
```
creditorPhone:debtorPhone (pk)
balance
```

- table `creditTotal` 
```
creditorPhone (pk)
balance
```

- table `debtTotal`
```
debtorPhone (pk)
balance
```

- table `debtHistory`
```
debtorPhone:creditorPhone (pk)
balance
```

- table: `userAccountIdMapping`
```
phone (pk)
id
```

- table: `userAccount`
```
id (pk)
name
phone
loc
pan
verification
balance
currentActive
createdAt
 ```

- table: `userTxn`
```
txnId (pk)
firstParty
secondParty
requestType
money
status
createdAt
currentActive
```

- table: `floatingCashRequest`
  indicates latest ask for floating cash request id
```
phone(pk)
id
```

- table: `userRequest`
```
id (pk)
phone
requestType
where
money
otherAccount
status
extraInfo
currentActive
createdAt
```

- table: `userAccountLedger`
```
id (pk)
phone
op
note
money
openingBalance
createdAt
```

- table `userBucket`
```
phoneWithBucketName (pk)
balance
```


Tests checklist (manual)
---
- [ ] Register new account
- [ ] Collect cash from customers using agents
- [ ] ATM Deposit
- [ ] ATM Withdraw
- [ ] Pay vendor
- [ ] Transfer money
- [ ] Create & update bucket
- [ ] See account balance
- [ ] See bucket balance
- [ ] Find ATM for deposit
- [ ] Find ATM for withdrawal
- [ ] Register credit
- [ ] Partial cash collection
- [ ] Checking history and balance of credits and debt
