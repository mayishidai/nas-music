import { useState, useEffect } from 'react'
import './index.css'

function App(props) {
  const init_data = props.init_data

  useEffect(()=>{
    console.log(init_data)
  }, [])

  let submited = false
  function submit() {
    if(submited){ return }
    submited = true
    const form = document.createElement('form');
    form.method = 'POST'
    form.action = '/post_page'
    form.style.display = 'none';
    const params = { 
      data: Math.random().toString(36).slice(2)
    }
    for (const key in params) {
      const input = document.createElement('input')
      input.name = key
      input.value = params[key]
      form.appendChild(input)
    }
    document.body.appendChild(form)
    form.submit()
  }

  return (
    <div className="container">
      <h1>  page1 - { init_data.uuid } - config: { init_data.data } </h1>
      <div><a href='/page2'> go to Page2 </a></div>
      <div><button onClick={submit}>  Post Page </button></div>
    </div>
  )
}

export default App