import axios from "axios";
import { useEffect } from "react";
import { useState } from "react";
const App = () => {
  const [text,setText]=useState("");
  useEffect(()=>{
    console.log("fjs")
    axios.get("/src")
    .then((response)=>{
      console.log(response.data);
    })
    .catch((err)=>{
      console.log(err);
    })

  },[]);
  return (
    <>
      <h1>hello world</h1>
    </>
  );
}
export default App;
