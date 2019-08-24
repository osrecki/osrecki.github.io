---
layout: post
title:  ADT serialisation with Play JSON
date:   2019-08-24 11:00:00 +0200
author: Dinko Osrecki
tags:   scala play json
---
Algebraic data type is a type formed by combining **product** types and **sum** types. Product type combines multiple
values of different types into one. It is called “tuple”, “record”, “struct”, “class”.  Sum type represents a value
that is either of one type or another. It is called “variant”, “enumeration”, “tagged union”.

In Scala, product type can be defined with `case class`, while sum type is represented by `sealed trait` and
`case object`s.

Product and sum types can also be combined to form hybrid ADTs. One such hybrid type is known as “Sum of Products”.
A very popular example of this type is a geometric shape. `Shape` is a sum type (together with its subclasses), while
`Rectangle`, `Ellipse` and `Polygon` are product types.

```scala
sealed trait Shape

case class Rectangle(x: Double, y: Double, width: Double, height: Double) extends Shape
case class Ellipse(x: Double, y: Double, width: Double, height: Double) extends Shape
case class Polygon(points: (Double, Double)*) extends Shape
```

When serialised as JSON, these types would typically contain additional `type` field, also known as a tag. This field
is used to distinguish between the types which share exactly the same fields, e.g. `Rectangle` and `Ellipse`.

```json
[
  {
    "type": "rectangle",
    "x": 2.0,
    "y": 1.0,
    "width": 15.0,
    "height": 10.0
  },
  {
    "type": "ellipse",
    "x": 5.0,
    "y": -4.0,
    "width": 9.0,
    "height": 4.0
  },
  {
    "type": "polygon",
    "points": [
      [-3.0, 4.0],
      [4.5, 15.0],
      [8.0, -4.8]
    ]
  }
]
```

In `play-json`, it is fairly straightforward to (de)serialise each `Shape` by defining implicit `Reads` and `Writes`
instances for each `case class`.

```scala
import play.api.libs.json._

object Rectangle {
  val tag = "rectangle"

  implicit val reads: Reads[Rectangle] = Json.reads[Rectangle]
  implicit val writes: Writes[Rectangle] = Json.writes[Rectangle]
}

object Ellipse {
  val tag = "ellipse"

  implicit val reads: Reads[Ellipse] = Json.reads[Ellipse]
  implicit val writes: Writes[Ellipse] = Json.writes[Ellipse]
}

object Polygon {
  val tag = "polygon"

  implicit val reads: Reads[Polygon] = Json.reads[Polygon]
  implicit val writes: Writes[Polygon] = Json.writes[Polygon]
}
```

This allows us to parse and stringify each subtype of `Shape` individually.

```scala
import play.api.libs.json.Json

val json =
  """
    | {
    |   "type": "rectangle",
    |   "x": 2.0,
    |   "y": 1.0,
    |   "width": 15.0,
    |   "height": 10.0
    | }
  """.stripMargin
Json.parse(json).as[Rectangle]

val rectangle = Rectangle(2.0, 1.0, 15.0, 10.0)
Json.toJson(rectangle)
```

However, we still cannot serialise shapes in a more generic way. The following code will not compile.

```scala
Json.parse(json).as[Shape] // No implicits found for parameter fjs: Reads[Shape]

val shape: Shape = Rectangle(2.0, 1.0, 15.0, 10.0)
Json.toJson(shape) // No implicits found for parameter tjs: Writes[Shape]
```

To read a `Shape` from JSON, we need to match on a `type` field, and based on its value use a reader from one of the
subclasses. In case that we meet an unknown type, we simply return an error. Since `Reads[A]` is invariant in type `A`,
we need to widen `Reads` of each subclass into `Reads[Shape]` with the help of `toShapeReads` implicit conversion.

To write a `Shape` into JSON, we simply match a value against its concrete type, and implicitly use the appropriate
writer.

```scala
import play.api.libs.json._

object Shape {
  implicit val reads: Reads[Shape] =
    (__ \ "type").read[String].flatMap {
      case Rectangle.tag => implicitly[Reads[Rectangle]]
      case Ellipse.tag   => implicitly[Reads[Ellipse]]
      case Polygon.tag   => implicitly[Reads[Polygon]]
      case _             => Reads.failed("Invalid Shape")
    }

  implicit val writes: Writes[Shape] = Writes {
    case rectangle: Rectangle => Json.toJson(rectangle)
    case ellipse: Ellipse     => Json.toJson(ellipse)
    case polygon: Polygon     => Json.toJson(polygon)
  }

  private implicit def toShapeReads[B <: Shape](reads: Reads[B]): Reads[Shape] = reads.widen
}
```

Now we can (de)serialise an array of `Shape`s.

```scala
val json =
  """
    |[
    |  {
    |    "type": "rectangle",
    |    "x": 2.0,
    |    "y": 1.0,
    |    "width": 15.0,
    |    "height": 10.0
    |  },
    |  {
    |    "type": "ellipse",
    |    "x": 5.0,
    |    "y": -4.0,
    |    "width": 9.0,
    |    "height": 4.0
    |  },
    |  {
    |    "type": "polygon",
    |    "points": [
    |      [-3.0, 4.0],
    |      [4.5, 15.0],
    |      [8.0, -4.8]
    |    ]
    |  }
    |]
  """.stripMargin
Json.parse(json).as[Iterable[Shape]]

val shapes = Seq(
  Rectangle(2.0, 1.0, 15.0, 10.0),
  Ellipse(5.0, -4.0, 9.0, 4.0),
  Polygon((-3.0, 4.0), (4.5, 15.0), (8.0, -4.8))
)
Json.toJson(shapes)
```
