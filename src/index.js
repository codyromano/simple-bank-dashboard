import moment from 'moment';

async function getJsonFromUploadedFile({ target: { files } }) {
  return new Promise((resolve, reject) => {
    const [ summaryFileUpload ] = files;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const parsedResult = JSON.parse(event.target.result);
        resolve(parsedResult);
      } catch (error) {
        reject('Error parsing uploaded file: ' + JSON.stringify(error));
      }
    };
    reader.readAsText(summaryFileUpload, 'UTF-8');
  });
}

function getMostRecentMonday() {
  const result = moment();

  if (result.day() === 0) {
    result.set('d', -1);
  }
  return result.set('d', 1);
}

function filterTransactionsSinceMostRecentMonday(spendSummary) {
  const { transactions } = spendSummary;
  const monday = getMostRecentMonday();
  const result = [];

  for (const record of transactions) {
    const { times: { when_recorded_local } } = record;

    if (moment(when_recorded_local).isAfter(monday)) {
      result.push(record);
    } else {
      break;
    }
  }

  return result;
}

function filterTransactionsByRelevantDebitPurchases(transactions) {
  return transactions.filter(record => {
    return record.bookkeeping_type === 'debit' &&
    !record.description.includes('Discover E Payment') &&
    !record.description.includes('Vanguard')
  });
}

// TODO: Could use max heap here
function getTopKPurchasesByDescription(transactions, k) {
  const mapDescriptionToTotal = transactions.reduce((map, { description, amounts: { amount } } ) => {
    map[description] = Math.round((map[description] || 0) + amount / 10000);
    return map;
  }, {});

  const mapTotalToDescription = Object.keys(mapDescriptionToTotal).reduce((map, description) => {
    const total = mapDescriptionToTotal[description];
    map[total] = description;
    return map;
  }, {});

  return Object.keys(mapTotalToDescription)
    .sort((a, b) => parseInt(a) > parseInt(b) ? -1 : 1)
    .slice(0, k)
    .map(total => {
    return {
      description: mapTotalToDescription[total],
      total,
    };
  });
}

function renderTopPurchases(topPurchases) {
  document.body.classList.add('with-purchases');

  const container = document.getElementById('top-purchases');
  for (const purchase of topPurchases) {
    const listItem = document.createElement('li');

    // TODO: Change this
    listItem.innerHTML = `<strong>$${purchase.total}</strong> ${purchase.description}`;
    container.appendChild(listItem);
  }
}

async function onSummaryFileInputChange(event) {
  try {
    const summaryData = await getJsonFromUploadedFile(event);
    const recentTransactions = filterTransactionsSinceMostRecentMonday(summaryData);
    const purchases = filterTransactionsByRelevantDebitPurchases(recentTransactions);

    const topPurchases = getTopKPurchasesByDescription(purchases, 10);
    renderTopPurchases(topPurchases);

  } catch (error) {
    console.log('Error: ', error);
  }
}


const summaryInput = document.getElementById('summary');
summaryInput.addEventListener('change', onSummaryFileInputChange);
