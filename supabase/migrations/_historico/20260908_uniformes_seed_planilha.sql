-- APLICADA em 11/08/2026. Carga inicial de Uniformes a partir da planilha
-- real da Tatiane (Controle Uniformes Geral.xlsx): abas "Lista DP" (quem
-- existe, com predio e departamento) e "Geral Funcionarios Tam" (tamanho por
-- pessoa e peca).
--
-- Duas normalizacoes que a planilha nao tinha:
--
-- 1. BORDADO SAI DO NOME DA PECA. A planilha escreve "POLO - Resibag Branca",
--    "SOCIAL - Resibag" — item e bordado grudados. Aqui o item e POLO BRANCA
--    ou SOCIAL, e o bordado (Sanwey/Resibag) e escolhido por LINHA da rodada.
--    Sem isso, "3 polos brancas Resibag" e "5 polos brancas Sanwey" nunca
--    somariam no consolidado.
--
-- 2. ESCALA DE TAMANHO POR PECA. POLO usa P/M/G/GG; SOCIAL usa Nº 1..7 e
--    tambem P/M/G/GG (a social feminina segue outra escala). Uma lista unica
--    ofereceria "Nº 3" pra uma polo.
--
-- Casamento entre as duas abas: exige MESMO PRIMEIRO NOME **E** MESMO
-- DEPARTAMENTO. A primeira versao casava so por primeiro nome e ligou
-- "JOSE LUIZ DANELLI" (Qualidade) ao "Jose Roberto" (DP), sobrescrevendo o
-- nome dele e pendurando o tamanho na pessoa errada — por isso a regra ficou
-- estrita. Quando nao casa, a linha vira uma PESSOA NOVA, visivel e
-- editavel, em vez de um vinculo errado e silencioso.
--
-- O nome da Lista DP NUNCA e sobrescrito. Quando a aba de tamanhos traz uma
-- versao mais completa ("Geraldo" -> "Geraldo Baena"), ela fica em `notes`
-- como variante, pra conferencia humana.
--
-- 13 pessoas entraram sem predio: sao as que so aparecem na aba de tamanhos.
-- Precisam do olho do Daniel (podem ser duplicatas de quem ja esta na lista).

insert into uniform_items (name, sizes, models, unit_price) values
  ('POLO AZUL',   array['P','M','G','GG'], array['Masculina','Feminina'], 69.90),
  ('POLO BRANCA', array['P','M','G','GG'], array['Masculina','Feminina'], 71.00),
  ('SOCIAL',      array['P','M','G','GG','Nº 1','Nº 2','Nº 3','Nº 4','Nº 5','Nº 6','Nº 7'], array['Masculina','Feminina'], 125.00);

insert into uniform_people (full_name, department, site, notes)
select v.n, v.d, v.s, v.o from (values
  ('Everton','Comercial','148','import#0'),
  ('Elaine','Comercial','148','import#1'),
  ('Clayton','Comercial','148','import#2'),
  ('Rafael','Comercial','148','import#3  variantes na planilha: Rafael Doddi'),
  ('Geraldo','Comercial','148','import#4  variantes na planilha: Geraldo Baena'),
  ('Fernando','Comercial','148','import#5'),
  ('Tatiane','Comercial','148','import#6'),
  ('Bruno','Comercial','148','import#7'),
  ('Taina','Comercial','148','import#8  variantes na planilha: Taina Ribeiro'),
  ('Daniela','Comercial','148','import#9  variantes na planilha: Daniela dos Anjos'),
  ('Leonardo','Resibag','148','import#10'),
  ('Julio','Resibag','148','import#11'),
  ('Ricardo','Informática','201','import#12  variantes na planilha: Ricardo Sidnei'),
  ('Gabriel','Informática','201','import#13  variantes na planilha: Gabriel Carriel'),
  ('Makoto','Financeiro','201','import#14  variantes na planilha: Makoto Osaki'),
  ('Tatiane','Financeiro','201','import#15  variantes na planilha: Tatiane Takeuchi'),
  ('Joice','Financeiro','201','import#16  variantes na planilha: Joice Neves'),
  ('Marcelo','Financeiro','201','import#17  variantes na planilha: Marcelo Fortunato'),
  ('Iara','Financeiro','201','import#18  variantes na planilha: Iara Oliveira'),
  ('Angela','Diretoria','201','import#19'),
  ('Kátia','DP','201','import#20  variantes na planilha: Katia Nicoleti'),
  ('José Roberto','DP','201','import#21'),
  ('Leandro','DP','201','import#22  variantes na planilha: Leandro Favero'),
  ('Beatriz','DP','201','import#23'),
  ('Thiago','DP','201','import#24  variantes na planilha: Thiago Neves'),
  ('Sarah','DP','201','import#25  variantes na planilha: Sarah Kimberlly Teixeira'),
  ('Anderson Palma','Monte Mor','Monte Mor','import#26  variantes na planilha: Anderson Luis Palma'),
  ('Lidiane','Engenharia','227','import#27'),
  ('Jonas','Engenharia','227','import#28'),
  ('Samia','Engenharia','227','import#29'),
  ('João Pedro','Engenharia','227','import#30'),
  ('Tamires','Engenharia','227','import#31'),
  ('Natalia','Engenharia','227','import#32'),
  ('Danelly','Qualidade','227','import#33'),
  ('Roberta','Qualidade','227','import#34  variantes na planilha: ROBERTA OLIVEIRA'),
  ('Adriana','Qualidade','227','import#35'),
  ('Marcos','Segurança do Trabalho','227','import#36'),
  ('Daniele','Segurança do Trabalho','227','import#37'),
  ('Thiago','P&D','227','import#38'),
  ('Matheus','P&D','227','import#39  variantes na planilha: Matheus Ibraim'),
  ('André','PCP','227','import#40'),
  ('Paulo','PCP','227','import#41'),
  ('Cristiano','PCP','227','import#42'),
  ('Everton','PCP','227','import#43'),
  ('Clovis','Suprimentos','227','import#44'),
  ('Ricardo','Suprimentos','227','import#45'),
  ('Stefany','Suprimentos','227','import#46  variantes na planilha: Stefani'),
  ('Tatiane','RH','227','import#47'),
  ('Marcela','RH','227','import#48  variantes na planilha: MARCELA MARQUES'),
  ('Ana','RH','227','import#49'),
  ('Mario','Comercial',null,'import#50'),
  ('Adriana macario','CQ',null,'import#51'),
  ('Danilo','Engenharia',null,'import#52'),
  ('Willian','Engenharia',null,'import#53'),
  ('Ícaro','Engenharia',null,'import#54'),
  ('Wellas Lustosa','Manutenção',null,'import#55'),
  ('Harrison Souza de Melo','Monte Mor',null,'import#56'),
  ('Danielle Silva','Monte Mor',null,'import#57'),
  ('Natalia Eugenio','Monte Mor',null,'import#58'),
  ('Kelly Sipião','Monte Mor',null,'import#59'),
  ('JOSE LUIZ DANELLI','QUALIDADE',null,'import#60'),
  ('IOSE LUIZ DANELLI','QUALIDADE',null,'import#61'),
  ('Alexandre Oliveira','SEGURANÇA',null,'import#62')
) as v(n,d,s,o);

insert into uniform_person_sizes (person_id, item_id, model, size)
select p.id, it.id, v.modelo, v.tamanho from (values
  ('import#0','POLO AZUL','Masculina','G'),
  ('import#0','POLO BRANCA','Masculina','G'),
  ('import#0','SOCIAL','Masculina','Nº 2'),
  ('import#3','POLO AZUL','Masculina','GG'),
  ('import#3','POLO BRANCA','Masculina','GG'),
  ('import#3','SOCIAL','Masculina','Nº 7'),
  ('import#9','POLO AZUL','Feminina','G'),
  ('import#9','SOCIAL','Feminina','G'),
  ('import#4','POLO AZUL','Masculina','G'),
  ('import#4','SOCIAL','Masculina','Nº 3'),
  ('import#8','SOCIAL','Feminina','M'),
  ('import#8','POLO AZUL','Feminina','G'),
  ('import#7','POLO AZUL','Masculina','G'),
  ('import#7','POLO BRANCA','Masculina','G'),
  ('import#2','POLO AZUL','Masculina','G'),
  ('import#5','POLO AZUL','Masculina','G'),
  ('import#50','POLO BRANCA',null,'M'),
  ('import#51','POLO BRANCA','Feminina','M'),
  ('import#27','POLO AZUL','Feminina','G'),
  ('import#27','SOCIAL','Feminina','G'),
  ('import#28','POLO AZUL','Masculina','M'),
  ('import#28','SOCIAL','Masculina','Nº 2'),
  ('import#32','POLO AZUL','Feminina','P'),
  ('import#31','POLO AZUL','Feminina','M'),
  ('import#30','POLO AZUL','Masculina','G'),
  ('import#29','POLO AZUL','Feminina','G'),
  ('import#52','POLO AZUL','Masculina','G'),
  ('import#53','POLO AZUL','Masculina','G'),
  ('import#54','POLO AZUL','Masculina','G'),
  ('import#18','POLO AZUL','Feminina','M'),
  ('import#16','POLO AZUL','Feminina','G'),
  ('import#14','POLO AZUL','Masculina','G'),
  ('import#17','POLO AZUL','Masculina','G'),
  ('import#15','POLO AZUL','Feminina','G'),
  ('import#12','POLO AZUL','Masculina','G'),
  ('import#13','POLO AZUL','Masculina','G'),
  ('import#55','POLO AZUL','Masculina','G'),
  ('import#26','POLO AZUL','Masculina','G'),
  ('import#56','POLO AZUL','Masculina','M'),
  ('import#57','POLO AZUL','Feminina','M'),
  ('import#58','POLO AZUL','Masculina','G'),
  ('import#59','POLO AZUL','Feminina','M'),
  ('import#39','POLO AZUL','Masculina','M'),
  ('import#20','POLO AZUL','Feminina','GG'),
  ('import#25','POLO AZUL','Feminina','P'),
  ('import#24','POLO AZUL','Masculina','G'),
  ('import#22','POLO AZUL','Masculina','GG'),
  ('import#34','POLO BRANCA','Feminina','G'),
  ('import#34','SOCIAL','Feminina','G'),
  ('import#60','POLO BRANCA','Masculina','M'),
  ('import#61','SOCIAL','Masculina','Nº 3'),
  ('import#11','POLO AZUL','Masculina','GG'),
  ('import#10','POLO AZUL','Masculina','M'),
  ('import#10','POLO BRANCA','Masculina','M'),
  ('import#10','SOCIAL','Masculina','Nº 1'),
  ('import#48','POLO AZUL','Feminina','G'),
  ('import#62','POLO BRANCA','Masculina','GG'),
  ('import#62','POLO AZUL','Masculina','GG'),
  ('import#44','SOCIAL','Masculina','Nº 1'),
  ('import#46','SOCIAL','Feminina','M'),
  ('import#46','POLO AZUL','Feminina','M'),
  ('import#45','POLO AZUL','Masculina','G')
) as v(tag,item,modelo,tamanho)
join uniform_people p on split_part(p.notes,' ',1) = v.tag
join uniform_items  it on it.name = v.item;