import { useState, useEffect } from 'react'
import './index.css'

function App(props) {
  const init_data = props.init_data

  useEffect(()=>{
    console.log(init_data)
    fetch('/api/user').then(res => res.json()).then(data => {
      console.log(data)
    })
  }, [])

  return (
    <div className="container">
      <h1>  page2 - { init_data.uuid } - config: { init_data.data } </h1>
      <button onClick={() => window.history.back()}>  GoBack </button>
    </div>
  )
}

export default App