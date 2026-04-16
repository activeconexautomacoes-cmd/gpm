const body = {
"submission": {
  "fields": {
    "Seu nome": "Alex Teste",
    "Qual a media do seu faturamento mensal?": "De R$ 10.000 a R$ 20.000"
  }
}
};

const getValue = (obj, path) => {
    if (!path || path === "none") return undefined;
    return path.split('.').reduce((acc, part) => acc && acc[part], obj);
};

console.log(getValue(body, "submission.fields.Qual a media do seu faturamento mensal?"));
