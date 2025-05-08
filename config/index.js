const ENV = process.env.NODE_ENV?.trim().toLowerCase()

const loadConfig = async (env) => {
  if(env){
    const data = await import(`./config.${env}.json`, { assert: { type: 'json' } });
    return data.default;
  }
  const data = await import(`./config.json`, { assert: { type: 'json' } });
  return data.default;
}

export default await loadConfig(ENV)