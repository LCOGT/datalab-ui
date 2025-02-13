import { useUserDataStore } from '@/stores/userData'
import { useConfigurationStore } from '@/stores/configuration'
import { useAlertsStore } from '@/stores/alerts'

// handles api requests for datasessions with configurable parameters and callback functions
async function fetchApiCall({ url, method, body = null, header, successCallback = null, failCallback = handleError }) {

  const store = useUserDataStore()

  const defaultHeader = {
    'Content-Type': 'application/json',
    'Accept': 'application/json',
  }
  if(store.authToken){
    defaultHeader['Authorization'] = `Token ${store.authToken}`
  }

  const config = {
    method: method,
    headers: header ? header : defaultHeader,
    body: body ? JSON.stringify(body) : null
  }

  try {
    const response = await fetch(url, config)
    // ok response but empty content
    if (response.ok && (!response.headers.has('content-length') || response.headers.get('content-length') == 0)) {
      successCallback ? successCallback(null) : null
    } else {
      const responseData = await response.json()
      if (!response.ok) {
        failCallback ? failCallback(responseData, response.status) : null
      } else {
        // Invoking success callback with responseData
        successCallback ? successCallback(responseData) : null
      }
      return responseData
    }
  } catch (error) {
    console.error('Error raised when sending request', error)
    failCallback ? failCallback(error) : null
  }
}

// manages api call failures by logging errors
const handleError = (response) => {
  const alert = useAlertsStore()
  response.error ? alert.setAlert('error', response.error) : console.error('API call failed with error:', response)
}

function deleteOperation(sessionId, operationId, successCallback, failCallback = handleError) {
  const configStore = useConfigurationStore()
  const url = configStore.datalabApiBaseUrl + 'datasessions/' + sessionId + '/operations/' + operationId + '/'
  fetchApiCall({ url: url, method: 'DELETE', successCallback: successCallback, failCallback: failCallback })
}

function deleteOperations(sessionId, operationIds, successCallback, failCallback = handleError) {
  const configStore = useConfigurationStore()
  const url = configStore.datalabApiBaseUrl + 'datasessions/' + sessionId + '/operations/bulk_delete/'
  const body = {ids: operationIds}
  fetchApiCall({ url: url, method: 'POST', body: body, successCallback: successCallback, failCallback: failCallback })
}


export { fetchApiCall, handleError, deleteOperation, deleteOperations }
