-- NF-FORNERIA-ADM · seed das 69 unidades reais em nf_forneria.units
-- Gerado a partir de src/data/franquias.json (2026-08-30). Campos fiscais
-- (cnpj, logradouro, numero, bairro, cep, codigo_municipio, telefone,
-- email) ficam null aqui -- preencher pela tela de edição de Franquias.
-- Idempotente: só insere o que ainda não existe (por tenant_id + name).

insert into nf_forneria.units (tenant_id, name, cidade, estado, uf, endereco, horario, imagem, active)
select t.id, v.name, v.cidade, v.estado, v.uf, v.endereco, v.horario, v.imagem, v.active
from (values
  ('Forneria Original', 'Barra da Tijuca', 'Rio de Janeiro', 'Rio de Janeiro', null, 'Avenida das Américas, 6700 - Bl 02/108 - Barra da Tijuca', 'Domingo a quinta – 17:00 às 23:30 | Sexta e Sábado – 17:00 às 0:00', 'https://kqsnhpiprdznmjhvgvao.supabase.co/storage/v1/object/public/unidades/barra-da-tijuca.png', true),
  ('Forneria Original', 'Vargem Pequena', 'Rio de Janeiro', 'Rio de Janeiro', null, 'Estrada Boca do Mato, 5 - LOJA 1A - Vargem Pequena', 'Domingo a Quinta – 17:30 às 23:00 | Sexta e Sábado – 17:30 às 0:00', 'https://kqsnhpiprdznmjhvgvao.supabase.co/storage/v1/object/public/unidades/vargem-pequena.png', true),
  ('Forneria Original', 'Freguesia', 'Rio de Janeiro', 'Rio de Janeiro', null, 'Estrada de Jacarepaguá, 6527 - Loja C - Anil', 'Domingo a Quinta – 17:30 às 23:00 | Sexta e Sábado – 17:30 às 0:00', 'https://kqsnhpiprdznmjhvgvao.supabase.co/storage/v1/object/public/unidades/freguesia.png', true),
  ('Forneria Original', 'Leblon', 'Rio de Janeiro', 'Rio de Janeiro', null, 'Rua Tubira, 8 - Loja E - Leblon', 'Domingo a Quinta – 12:00 às 23:00 | Sexta e Sábado – 12:00 às 2:00', 'https://kqsnhpiprdznmjhvgvao.supabase.co/storage/v1/object/public/unidades/leblon.png', true),
  ('Forneria Original', 'Jardim Oceânico', 'Rio de Janeiro', 'Rio de Janeiro', null, 'Avenida Érico Veríssimo, 971 - Barra da Tijuca', 'Domingo a Quinta – 17:30 às 23:30 | Sexta e Sábado – 17:30 às 0:00', 'https://kqsnhpiprdznmjhvgvao.supabase.co/storage/v1/object/public/unidades/jardim-oceanico.png', true),
  ('Forneria Original', 'Rio 2', 'Rio de Janeiro', 'Rio de Janeiro', null, 'Avenida Embaixador Abelardo Bueno, 3500 - Jacarepaguá', 'Domingo a Quarta – 17:15 às 23:00 | Quinta – 17:15 às 23:30 | Sexta e Sábado – 17:15 às 0:00', 'https://kqsnhpiprdznmjhvgvao.supabase.co/storage/v1/object/public/unidades/rio-2.png', true),
  ('Forneria Original', 'Recreio dos Bandeirantes', 'Rio de Janeiro', 'Rio de Janeiro', null, 'Rua Alberto Cavalcanti, 540 - Loja G - Recreio dos Bandeirantes', 'Domingo a Quinta – 17:15 às 23:00 | Sexta e Sábado – 17:15 às 0:00', 'https://kqsnhpiprdznmjhvgvao.supabase.co/storage/v1/object/public/unidades/recreio-dos-bandeirantes.png', true),
  ('Forneria Original', 'Tijuca 1', 'Rio de Janeiro', 'Rio de Janeiro', null, 'Rua Conde de Bonfim, 116 - Loja C - Tijuca', 'Domingo a Quinta – 17:30 às 23:30 | Sexta e Sábado – 17:30 às 0:00', 'https://kqsnhpiprdznmjhvgvao.supabase.co/storage/v1/object/public/unidades/tijuca-1.png', true),
  ('Forneria Original', 'Botafogo', 'Rio de Janeiro', 'Rio de Janeiro', null, 'Rua Mena Barreto, 106 - Botafogo', 'Segunda e Terça – 17:00 às 23:00 | Domingo, Quarta e Quinta – 17:00 às 23:30 | Sexta e Sábado – 17:00 às 0:00', 'https://kqsnhpiprdznmjhvgvao.supabase.co/storage/v1/object/public/unidades/botafogo.png', true),
  ('Forneria Original', 'Taquara', 'Rio de Janeiro', 'Rio de Janeiro', null, 'Estrada do Tindiba, 2695 - Loja F - Taquara', 'Domingo a Quinta – 17:30 às 23:00 | Sexta e Sábado – 17:30 às 23:30', 'https://kqsnhpiprdznmjhvgvao.supabase.co/storage/v1/object/public/unidades/taquara.png', true),
  ('Forneria Original', 'Méier', 'Rio de Janeiro', 'Rio de Janeiro', null, 'Rua Ana Barbosa, 35 - Méier', 'Domingo a Quinta – 17:00 às 23:30 | Sexta e Sábado – 17:00 às 0:00', 'https://kqsnhpiprdznmjhvgvao.supabase.co/storage/v1/object/public/unidades/meier.png', true),
  ('Forneria Original', 'Grajaú / Vila Isabel', 'Rio de Janeiro', 'Rio de Janeiro', null, 'Rua José Vicente, 25 - Loja A - Grajaú', 'Domingo a Quinta – 17:30 às 23:00 | Sexta e Sábado – 17:30 às 23:30', 'https://kqsnhpiprdznmjhvgvao.supabase.co/storage/v1/object/public/unidades/grajau-vila-isabel.png', true),
  ('Forneria Original', 'Vila Valqueire', 'Rio de Janeiro', 'Rio de Janeiro', null, 'Rua Luiz Beltrão, 646 - Vila Valqueire', 'Domingo a Quinta – 17:30 às 23:00 | Sexta e Sábado – 17:30 às 0:00', 'https://kqsnhpiprdznmjhvgvao.supabase.co/storage/v1/object/public/unidades/vila-valqueire.png', true),
  ('Forneria Original', 'Campo Grande', 'Rio de Janeiro', 'Rio de Janeiro', null, 'Rua Augusto de Vasconcelos, 885 - Campo Grande', 'Domingo a Sábado – 17:30 às 23:30', 'https://kqsnhpiprdznmjhvgvao.supabase.co/storage/v1/object/public/unidades/campo-grande.png', true),
  ('Forneria Original', 'Ilha do Governador', 'Rio de Janeiro', 'Rio de Janeiro', null, 'Estrada do Galeão, 826 - Loja A - Jardim Carioca', 'Domingo a Quinta – 17:30 às 23:00 | Sexta e Sábado – 17:30 às 0:00', 'https://kqsnhpiprdznmjhvgvao.supabase.co/storage/v1/object/public/unidades/ilha-do-governador.png', true),
  ('Forneria Original', 'Copacabana', 'Rio de Janeiro', 'Rio de Janeiro', null, 'Rua Siqueira Campos, 253 - Loja D - Copacabana', 'Segunda a Quinta – 17:15 às 23:15 | Sexta e Sábado – 16:15 às 02:00 | Domingo e Feriados – 17:15 às 23:59', 'https://kqsnhpiprdznmjhvgvao.supabase.co/storage/v1/object/public/unidades/copacabana.png', true),
  ('Forneria Original', 'Bangu', 'Rio de Janeiro', 'Rio de Janeiro', null, 'Rua Rio da Prata, 435 - Loja 2 - Bangu', 'Segunda a Quarta – 17:30 às 23:30 | Quinta a Domingo – 17:30 às 0:00', 'https://kqsnhpiprdznmjhvgvao.supabase.co/storage/v1/object/public/unidades/bangu.png', true),
  ('Forneria Original', 'Duque de Caxias', 'Duque de Caxias', 'Rio de Janeiro', null, 'Avenida Perimetral Professor José de Souza Herdy, 1216 - Shopping Unigranrio - Jardim 25 de Agosto', 'Domingo a Quinta – 17:30 às 23:30 | Sexta e Sábado – 17:30 às 0:00', 'https://kqsnhpiprdznmjhvgvao.supabase.co/storage/v1/object/public/unidades/duque-de-caxias.png', true),
  ('Forneria Original', 'Vila da Penha', 'Rio de Janeiro', 'Rio de Janeiro', null, 'Avenida Meriti, 2940 - Lote 3, Pal 42729, Brás de Pina - Vila da Penha', 'Domingo a Quinta – 17:15 às 23:00 | Sexta e Sábado – 17:15 às 23:30', 'https://kqsnhpiprdznmjhvgvao.supabase.co/storage/v1/object/public/unidades/vila-da-penha.png', true),
  ('Forneria Original', 'Nova Iguaçu', 'Nova Iguaçu', 'Rio de Janeiro', null, 'Rua Humberto Gentil Baroni, 150 - Centro', 'Domingo a Quinta – 17:30 às 23:00 | Sexta, Sábado e Feriados – 17:30 às 0:00', 'https://kqsnhpiprdznmjhvgvao.supabase.co/storage/v1/object/public/unidades/nova-iguacu.png', true),
  ('Forneria Original', 'Icaraí', 'Niterói', 'Rio de Janeiro', null, 'Rua Geraldo Martins, 134 - Loja 101 - Icaraí', 'Domingo a Quinta – 17:30 às 23:30 | Sexta, Sábado e Feriados – 17:30 às 23:30', 'https://kqsnhpiprdznmjhvgvao.supabase.co/storage/v1/object/public/unidades/icarai.png', true),
  ('Forneria Original', 'Olaria', 'Rio de Janeiro', 'Rio de Janeiro', null, 'Rua Filomena Nunes, 1.170 - Loja D - Olaria', 'Domingo a Quinta – 17:15 às 23:00 | Sexta e Sábado – 17:15 às 23:30', 'https://kqsnhpiprdznmjhvgvao.supabase.co/storage/v1/object/public/unidades/olaria.png', true),
  ('Forneria Original', 'Tijuca Ii', null, null, null, null, null, null, true),
  ('Forneria Original', 'Flamengo', 'Rio de Janeiro', 'Rio de Janeiro', null, 'Rua Buarque de Macedo, 22 - Flamengo', 'Domingo a Quinta – 17:15 às 23:00 | Sexta e Sábado – 17:15 às 23:30', 'https://kqsnhpiprdznmjhvgvao.supabase.co/storage/v1/object/public/unidades/flamengo.png', true),
  ('Forneria Original', 'Região Oceânica de Niterói', 'Niterói', 'Rio de Janeiro', null, 'Avenida Francisco da Cruz Nunes, 1042 - Piratininga', 'Domingo a Quarta – 17:15 às 23:00 | Quinta – 17:15 as 0:00 | Sexta e Sábado – 17:15 as 01:00', 'https://kqsnhpiprdznmjhvgvao.supabase.co/storage/v1/object/public/unidades/regiao-oceanica-de-niteroi.png', true),
  ('Forneria Original', 'Campo Grande 2', null, null, null, null, null, null, true),
  ('Forneria Original', 'Vila Velha', 'Vila Velha', 'Espírito Santo', null, 'Avenida Champagnat, 920 - Loja C - Praia da Costa', 'Segunda – 17:30 às 23:00 | Terça a Domingo – 17:30 às 23:30', 'https://kqsnhpiprdznmjhvgvao.supabase.co/storage/v1/object/public/unidades/vila-velha.png', true),
  ('Forneria Original', 'Abolição', null, null, null, null, null, null, true),
  ('Forneria Original', 'Goiânia - Marista', 'Goiânia', 'Goiás', null, 'Av 85, 2660 - Sala 2 - Setor Marista', 'Domingo a Quinta – 17:30 às 23:30 | Sexta e Sábado – 17:30 às 23:45 | Forneria Original Massas: | Marista das 10:45 as 15:00', 'https://kqsnhpiprdznmjhvgvao.supabase.co/storage/v1/object/public/unidades/goiania-marista.png', true),
  ('Forneria Original', 'Petrópolis', 'Petrópolis', 'Rio de Janeiro', null, 'Rua Gonçalves Dias, 638 - Valparaíso', 'Domingo a Quinta – 17:30 às 23:30 | Sexta e Sábado – 17:30 às 0:00', 'https://kqsnhpiprdznmjhvgvao.supabase.co/storage/v1/object/public/unidades/petropolis.png', true),
  ('Forneria Original', 'Nilópolis/Mesquita', 'Mesquita', 'Rio de Janeiro', null, 'Rua João Bittencourt, 74 - Quadra 28 - Lote 582 – Santa Terezinha', 'Domingo, Terça, Quarta e Quinta – 17:30 às 23:30 | Sexta e Sábado – 17:30 às 23:59', 'https://kqsnhpiprdznmjhvgvao.supabase.co/storage/v1/object/public/unidades/nilopolis-mesquita.jpg', true),
  ('Forneria Original', 'Cabo Frio', 'Cabo Frio', 'Rio de Janeiro', null, 'Rua José Bonifácio, 68 - Loja 2 - Centro', 'Todos os Dias – 17:15 às 23:30', 'https://kqsnhpiprdznmjhvgvao.supabase.co/storage/v1/object/public/unidades/cabo-frio.png', true),
  ('Forneria Original', 'Goiânia - Oeste', 'Goiânia', 'Goiás', null, 'Rua Ruy Brasil Cavalcante, 170 - Quadra R25 LT 18 - Setor Oeste', 'Segunda a Sexta – 17:30 às 23:15 | Sábado e Domingo – 17:30 às 23:30', 'https://kqsnhpiprdznmjhvgvao.supabase.co/storage/v1/object/public/unidades/goiania-oeste.png', true),
  ('Forneria Original', 'Itaipava', 'Petrópolis', 'Rio de Janeiro', null, 'Estrada União e Indústria, 10425 - Itaipava', 'Domingo a Quinta – 17:00 às 23:30 | Sexta e Sábado – 17:00 às 23:59', 'https://kqsnhpiprdznmjhvgvao.supabase.co/storage/v1/object/public/unidades/itaipava.png', true),
  ('Forneria Original', 'Belo Horizonte', 'Belo Horizonte', 'Minas Gerais', null, 'Rua Major Lopes, 47 - São Pedro', 'Segunda a quinta – 17:00 às 23:30 | Sexta e Domingo – 17:00 às 0:00', 'https://kqsnhpiprdznmjhvgvao.supabase.co/storage/v1/object/public/unidades/belo-horizonte.png', true),
  ('Forneria Original', 'Águas Claras - Brasília', 'Brasília', 'Brasília', null, 'Rua 17, 03 - Norte (Águas Claras)', 'Domingo a Quinta – 17:15 às 23:30 | Sexta e Sábado – 17:15 às 0:00 | Asa Norte - Brasília | Asa Norte Shc 309 Bloco D Lj 48 | Asa Norte | Brasília - DF - 70755-040 | Telefone: 61 3686-2222', 'https://kqsnhpiprdznmjhvgvao.supabase.co/storage/v1/object/public/unidades/aguas-claras-brasilia.png', true),
  ('Forneria Original', 'Volta Redonda', 'Volta Redonda', 'Rio de Janeiro', null, 'Rua Simão da Cunha Gago, 195 - Aterrado', 'Domingo a Quinta – 17:30 às 23:30 | Sexta e Sábado – 17:30 às 23:59', 'https://kqsnhpiprdznmjhvgvao.supabase.co/storage/v1/object/public/unidades/volta-redonda.png', true),
  ('Forneria Original', 'Juiz de Fora', 'Juiz de Fora', 'Minas Gerais', null, 'Rua Padre Café, 509 - São Mateus', 'Segunda a quinta – 17:30 as 23:00 | Sexta à Domingo – 17:30 as 23:59', 'https://kqsnhpiprdznmjhvgvao.supabase.co/storage/v1/object/public/unidades/juiz-de-fora.png', true),
  ('Forneria Original', 'Jardim Goiás', 'Goiânia', 'Goiás', null, 'Rua 53, 389 - Jardim Goiás', 'segunda a quinta	17:30–23:30
sexta e sábado	17:30–23:45
domingo	17:30–23:30', 'https://kqsnhpiprdznmjhvgvao.supabase.co/storage/v1/object/public/unidades/jardim-goias.png', true),
  ('Forneria Original', 'Jardim Atlântico', 'Goiânia', 'Goiás', null, 'Avenida Ipanema, 879 - Jardim Atlântico', 'Domingo a Quinta – 17:30 às 23:30 | Sexta e Sábado – 17:30 às 23:45 | Forneria Original Massas: | Jardim Atlântico das 10:45 as 15:00', 'https://kqsnhpiprdznmjhvgvao.supabase.co/storage/v1/object/public/unidades/jardim-atlantico.png', true),
  ('Forneria Original', 'Anápolis', 'Goiânia', 'Goiás', null, 'Av. Goiás, 30 - Quadra 5 - Lt 30 Sl 04/05 – Vila Santana', 'Segunda a Quinta – 17:30 às 23:30 | Sexta e Sábado – 17:30 às 23:45 | Domingo – 17:30 às 23:30', 'https://kqsnhpiprdznmjhvgvao.supabase.co/storage/v1/object/public/unidades/anapolis.jpg', true),
  ('Forneria Original', 'Blumenau', null, null, null, null, null, null, true),
  ('Forneria Original', 'Macaé', 'Macaé', 'Rio de Janeiro', null, 'Rua Professora Anna Benedicta, 641 - Casa 1 - Glória', 'Terça a Quinta e Domingo – 17:00 às 23:00 | Sexta e Sábado – 17:00 às 0:00', 'https://kqsnhpiprdznmjhvgvao.supabase.co/storage/v1/object/public/unidades/macae.png', true),
  ('Forneria Original', 'Campinas', 'Campinas', 'São Paulo', null, 'R DOUTOR SAMPAIO FERRAZ, 515 - LOJA - Cambuí', 'Segunda a quinta 17:30 às 23:30
Sexta 17:30 às 00:00
Sábado 17:00 às 00:00
Domingo 17:00 às 23:30', 'https://kqsnhpiprdznmjhvgvao.supabase.co/storage/v1/object/public/unidades/campinas.png', true),
  ('Forneria Original', 'Recife - Zona Norte', 'Recife', 'Pernambuco', null, 'Rua das Graças, 239 - Graças', 'Todos os Dias – 17:00 às 23:30 | Espaço Forneria Original: | Quarta a Domingo – 18:00 às 23:00 | Seg e terça só com reservas a partir de 10 pessoas', 'https://kqsnhpiprdznmjhvgvao.supabase.co/storage/v1/object/public/unidades/recife-zona-norte.jpg', true),
  ('Forneria Original', 'Agua Verde', null, null, null, null, null, null, true),
  ('Forneria Original', 'Campo Belo', 'São Paulo', 'São Paulo', null, 'Rua Dr. Jesuíno Maciel, 821 - Campo Belo', 'Domingo a Quinta – 17:00 às 23:30 | Sexta e Sábado – 17:30 às 0:00', 'https://kqsnhpiprdznmjhvgvao.supabase.co/storage/v1/object/public/unidades/campo-belo.png', true),
  ('Forneria Original', 'São Pedro da Aldeia', 'São Pedro da Aldeia', 'Rio de Janeiro', 'RJ', 'Rua José dos Santos Silva, 115 - Loja 2', 'Domingo a Quinta – 17:30 às 23:30 | Sexta e Sábado – 17:30 às 23:59', 'https://kqsnhpiprdznmjhvgvao.supabase.co/storage/v1/object/public/unidades/sao-pedro-da-aldeia.png', true),
  ('Forneria Original', 'Teresópolis', 'Teresópolis', 'Rio de Janeiro', null, 'Rua Waldir Barbosa Moreira, 55 - Várzea', 'Domingo a Quinta – 17:00 às 23:30 | Sexta e Sábado – 17:00 às 23:59', 'https://kqsnhpiprdznmjhvgvao.supabase.co/storage/v1/object/public/unidades/teresopolis.png', true),
  ('Forneria Original', 'Búzios', 'Armação dos Búzios', 'Rio de Janeiro', null, 'Rua Canto Esquerdo de Geribá, 236 - Alto de Búzios', 'Terça a Domingo – 17:30 às 00:30', 'https://kqsnhpiprdznmjhvgvao.supabase.co/storage/v1/object/public/unidades/buzios.png', true),
  ('Forneria Original', 'Campos dos Goytacazes', 'Campos dos Goytacazes', 'Rio de Janeiro', null, 'Rua Álvaro Tâmega, 201 - Centro', 'Domingo a Quinta – 17:30 às 23:30 | Sexta e Sábado – 17:30 às 23:59', 'https://kqsnhpiprdznmjhvgvao.supabase.co/storage/v1/object/public/unidades/campos-dos-goytacazes.jpg', true),
  ('Forneria Original', 'Recife - Zona Sul', 'Recife', 'Pernambuco', null, 'Rua Capitão Zuzinha, 184 - Boa Viagem', 'Todos os Dias – 17:00 às 23:30', 'https://kqsnhpiprdznmjhvgvao.supabase.co/storage/v1/object/public/unidades/recife-zona-sul.png', true),
  ('Forneria Original', 'Asa Norte', 'DF', 'Brasília', null, 'CLN 309 Bloco D, 309 - Asa Norte', 'terça-feira	17:30–23:00
quarta-feira	17:30–23:00
quinta-feira	17:30–23:00
sexta-feira	17:30–23:30
sábado	17:30–23:30
domingo	17:30–23:00
segunda-feira	17:30–23:00', 'https://kqsnhpiprdznmjhvgvao.supabase.co/storage/v1/object/public/unidades/asa-norte.png', true),
  ('Forneria Original', 'Nova Friburgo', 'Nova Friburgo', 'Rio de Janeiro', null, 'Rua Francisco Mielli, 10 - Centro', 'segunda-feira	Fechado
terça a quinta	17:30–23:00
sexta-feira	17:30–23:30
sábado	17:30–23:30
domingo	17:30–23:30', 'https://kqsnhpiprdznmjhvgvao.supabase.co/storage/v1/object/public/unidades/nova-friburgo.png', true),
  ('Forneria Original', 'São Gonçalo', 'São Gonçalo', 'Rio de Janeiro', null, 'Rua Jaime de Figueiredo, 1890 - Camarão', 'Todos os dias 17:00–00:00', 'https://kqsnhpiprdznmjhvgvao.supabase.co/storage/v1/object/public/unidades/sao-goncalo.jpeg', true),
  ('Forneria Original', 'São José dos Campos', 'São José dos Campos', 'São Paulo', null, 'Rua Eliza Costa Santos, 156 - Jardim São Dimas', 'segunda a quinta	17:00–23:30
sexta-feira	17:00–00:00
sábado	17:00–00:00
domingo	17:00–23:30', 'https://kqsnhpiprdznmjhvgvao.supabase.co/storage/v1/object/public/unidades/sao-jose-dos-campos.png', true),
  ('The Duck', 'Recreio', null, null, null, null, null, null, true),
  ('The Duck', 'Barra Da Tijuca', null, null, null, null, null, null, true),
  ('The Duck', 'Grajaú', null, null, null, null, null, null, true),
  ('The Duck', 'Vila Da Penha', null, null, null, null, null, null, true),
  ('The Duck', 'Nova Iguaçu', null, null, null, null, null, null, true),
  ('The Duck', 'Anapolis', null, null, null, null, null, null, true),
  ('The Duck', 'Vila Valqueire', null, null, null, null, null, null, true),
  ('The Duck', 'Bangu', null, null, null, null, null, null, true),
  ('The Duck', 'São José', null, null, null, null, null, null, true),
  ('The Duck', 'Flamengo', null, null, null, null, null, null, true),
  ('The Duck', 'Freguesia', null, null, null, null, null, null, true),
  ('The Duck', 'Jd. Goiás', null, null, null, null, null, null, true),
  ('The Duck', 'Jd. Oceânico', null, null, null, null, null, null, true)
) as v(tenant_name, name, cidade, estado, uf, endereco, horario, imagem, active)
join nf_forneria.tenants t on t.name = v.tenant_name
where not exists (
  select 1 from nf_forneria.units u where u.tenant_id = t.id and u.name = v.name
);
