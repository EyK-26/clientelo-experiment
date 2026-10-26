export const worksheet = {
  questions: [
    {
      title: "Přesný produkt",
      text: "Odpovídají název a identifikátor skutečnému ETF, nebo jde o jiný nástroj?",
    },
    {
      title: "Povolení nového nákupu",
      text: "Mohu tento konkrétní fond nově koupit jako český rezident a neprofesionální klient společnosti, která vede můj účet?",
    },
    {
      title: "Dokument KID",
      text: "Je pro tento produkt dostupný požadovaný KID v příslušném jazyce a kde ho najdu?",
    },
    {
      title: "Náklady obchodu",
      text: "Jaké jsou provize a náklady směny měny? Kde zjistím aktuální nákupní a prodejní cenu a rozdíl mezi nimi?",
    },
    {
      title: "Podmínky pokynu",
      text: "V jaké měně obchoduji? Jaká je minimální částka nebo počet kusů pro jeden nákup? Nabízíte zlomkové podíly tohoto fondu?",
    },
    {
      title: "Doklad a datum",
      text: "Kde najdu potvrzení uvedených podmínek a ke kterému datu platí?",
    },
  ],
  terms: [
    {
      title: "Index a fond",
      text: "Index je měřítko trhu; ETF je konkrétní fond, který se ho snaží sledovat. Stejný index neznamená totožný fond ani stejné výsledky.",
    },
    {
      title: "Nákladový poměr",
      text: "Průběžné roční náklady fondu vyjádřené procentem. Nezahrnují všechny vaše náklady, například provizi brokera, směnu měny nebo rozdíl nákupní a prodejní ceny.",
    },
    {
      title: "Primární kotace",
      text: "Burza, na které je fond primárně kotovaný. Neurčuje sama o sobě dostupnost pro váš účet ani místo provedení obchodu.",
    },
    {
      title: "KID",
      text: "Dokument s klíčovými informacemi podle pravidel PRIIPs. Jeho dostupnost může ovlivnit, zda broker dovolí neprofesionálnímu klientovi nový nákup.",
    },
  ],
  brokerMessage:
    "Dobrý den, ověřuji dostupnost fondu [celý název, ticker a identifikátor] pro [typ účtu a klasifikace klienta]. Můžete prosím potvrdit, zda jde o skutečný fond ETF, zda je povolen nový nákup a kde najdu příslušný KID a podmínky poplatků, směny měny a minimální velikosti pokynu? Prosím také o zdroj a datum platnosti odpovědi. Děkuji.",
} as const;
