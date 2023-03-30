const waitFor = async function waitFor(txPromise) {
    return await txPromise.then((tx) => tx.wait());
}

module.exports = {
    waitFor,
}
